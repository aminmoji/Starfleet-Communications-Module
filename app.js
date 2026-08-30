require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const userRouter = require("./routes/userRoute");
const User = require("./models/userModel");
const Chat = require("./models/chatModel");
const { issueCsrfToken } = require("./middlewares/csrf");
const MongoSessionStore = require("./middlewares/mongoSessionStore");
const { securityHeaders } = require("./middlewares/security");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 12 * 1024 * 1024,
});

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || "local-development-secret-change-me";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production");
}

const sessionMiddleware = session({
  name: "starfleet.sid",
  secret: sessionSecret,
  store: isProduction ? new MongoSessionStore() : undefined,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000,
  },
});

app.disable("x-powered-by");
if (isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(securityHeaders);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(sessionMiddleware);
app.use(issueCsrfToken);
app.use(
  express.static(path.join(__dirname, "public"), {
    dotfiles: "deny",
    etag: true,
    maxAge: isProduction ? "1h" : 0,
  })
);

app.get("/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "degraded",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

app.use("/", userRouter);

app.use((req, res) => {
  res.status(404).render("login", { message: "That channel does not exist." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const isUploadError = error?.name === "MulterError" || error?.code === "INVALID_FILE_TYPE";
  const status = isUploadError ? 400 : 500;
  const message = isUploadError
    ? "Upload a JPEG, PNG, or WebP image no larger than 1 MB."
    : "The communications array encountered an error.";

  console.error(error);
  return res.status(status).render("login", { message });
});

io.engine.use(sessionMiddleware);

const userNamespace = io.of("/user-namespace");
const activeSockets = new Map();

userNamespace.use((socket, next) => {
  const userId = socket.request.session?.userId;

  if (!mongoose.isValidObjectId(userId)) {
    return next(new Error("Authentication required"));
  }

  socket.userId = String(userId);
  return next();
});

userNamespace.on("connection", async (socket) => {
  const userId = socket.userId;
  let recentMessages = [];
  const sockets = activeSockets.get(userId) || new Set();
  sockets.add(socket.id);
  activeSockets.set(userId, sockets);
  socket.join(userId);

  try {
    await User.findByIdAndUpdate(userId, { is_online: true });
    socket.broadcast.emit("getOnlineUser", { user_id: userId });
  } catch (error) {
    console.error("Unable to update presence", error);
  }

  socket.on("registerEncryptionKey", async ({ publicKey } = {}, respond = () => {}) => {
    try {
      if (typeof publicKey !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey) || publicKey.length > 512) {
        return respond({ success: false, message: "Invalid encryption key." });
      }
      const user = await User.findByIdAndUpdate(
        userId,
        { encryptionPublicKey: publicKey, $inc: { encryptionKeyVersion: 1 } },
        { new: true }
      ).select("+encryptionPublicKey encryptionKeyVersion");
      return respond({ success: true, keyVersion: user.encryptionKeyVersion });
    } catch (error) {
      console.error("Unable to register encryption key", error);
      return respond({ success: false, message: "Encryption setup failed." });
    }
  });

  socket.on("getEncryptionKey", async ({ receiver_id: receiverId } = {}, respond = () => {}) => {
    try {
      if (!mongoose.isValidObjectId(receiverId)) return respond({ success: false });
      const user = await User.findById(receiverId).select("+encryptionPublicKey encryptionKeyVersion").lean();
      if (!user?.encryptionPublicKey) return respond({ success: false, message: "This crew member has not opened a secure channel yet." });
      return respond({ success: true, publicKey: user.encryptionPublicKey, keyVersion: user.encryptionKeyVersion });
    } catch (error) {
      return respond({ success: false, message: "Unable to establish the secure channel." });
    }
  });

  socket.on("existingChats", async ({ receiver_id: receiverId } = {}, respond = () => {}) => {
    try {
      if (!mongoose.isValidObjectId(receiverId)) {
        return respond({ success: false, message: "Select a valid crew member." });
      }

      const chats = await Chat.find({
        $or: [
          { sender_id: userId, receiver_id: receiverId },
          { sender_id: receiverId, receiver_id: userId },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const decryptedChats = chats.map((chat) => ({
        ...chat,
        message: Chat.schema.path("message").get(chat.message),
      }));

      decryptedChats.reverse();
      return respond({ success: true, chats: decryptedChats });
    } catch (error) {
      console.error("Unable to load conversation", error);
      return respond({ success: false, message: "Conversation history is unavailable." });
    }
  });

  socket.on("sendChat", async ({ receiver_id: receiverId, ciphertext, iv, keyVersion, attachment } = {}, respond = () => {}) => {
    try {
      const now = Date.now();
      recentMessages = recentMessages.filter((timestamp) => now - timestamp < 10_000);

      const validCiphertext = typeof ciphertext === "string" && ciphertext.length > 0 && ciphertext.length <= 12_000_000;
      const validIv = typeof iv === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(iv) && iv.length <= 64;
      const validAttachment = !attachment || (
        typeof attachment.ciphertext === "string" && attachment.ciphertext.length <= 12_000_000 &&
        typeof attachment.iv === "string" && attachment.iv.length <= 64
      );
      if (!mongoose.isValidObjectId(receiverId) || !validCiphertext || !validIv || !Number.isInteger(keyVersion) || !validAttachment) {
        return respond({ success: false, message: "Invalid encrypted transmission." });
      }
      if (recentMessages.length >= 20) {
        return respond({ success: false, message: "Message rate limit reached. Try again shortly." });
      }

      const receiverExists = await User.exists({ _id: receiverId });
      if (!receiverExists) {
        return respond({ success: false, message: "That crew member is unavailable." });
      }

      const chat = await Chat.create({
        sender_id: userId,
        receiver_id: receiverId,
        ciphertext,
        iv,
        keyVersion,
        attachment: attachment || undefined,
      });
      recentMessages.push(now);
      const payload = chat.toObject({ getters: true });

      userNamespace.to(String(receiverId)).emit("loadNewChat", payload);
      return respond({ success: true, chat: payload });
    } catch (error) {
      console.error("Unable to send message", error);
      return respond({ success: false, message: "Message delivery failed." });
    }
  });

  // WebRTC signaling only: call audio/video never traverses this server.
  for (const eventName of ["call:offer", "call:answer", "call:ice", "call:end"]) {
    socket.on(eventName, ({ receiver_id: receiverId, payload } = {}, respond = () => {}) => {
      if (!mongoose.isValidObjectId(receiverId) || !payload) return respond({ success: false });
      userNamespace.to(String(receiverId)).emit(eventName, { sender_id: userId, payload });
      return respond({ success: true });
    });
  }

  socket.on("disconnect", async () => {
    const socketsForUser = activeSockets.get(userId);
    socketsForUser?.delete(socket.id);

    if (socketsForUser?.size) {
      return;
    }

    activeSockets.delete(userId);
    try {
      await User.findByIdAndUpdate(userId, { is_online: false });
      socket.broadcast.emit("getOfflineUser", { user_id: userId });
    } catch (error) {
      console.error("Unable to update presence", error);
    }
  });
});

async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await mongoose.connect(process.env.DATABASE_URL);
  const port = Number(process.env.PORT) || 3000;

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Starfleet Communications listening on port ${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

module.exports = { app, server, start };
