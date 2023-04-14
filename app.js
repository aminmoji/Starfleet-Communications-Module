require("dotenv").config();

const mongoose = require("mongoose");
mongoose.connect(process.env.DATABASE_URL);

mongoose_db = mongoose.connection;

mongoose_db.on("error", (err) => console.log(`${err.message} LCARS Down`));
mongoose_db.on("connected", () => console.log("LCARS Connected"));
mongoose_db.on("disconnected", () => console.log("LCARS Disconnected"));
const app = require("express")();

const http = require("http").Server(app);

const userRoute = require("./routes/userRoute");
const User = require("./models/userModel");
const Chat = require("./models/chatModel");

app.use("/", userRoute);

const io = require("socket.io")(http);

let usp = io.of("/user-namespace");

usp.on("connection", async (socket) => {
  console.log("User Connected");
  let userId = socket.handshake.auth.token;
  await User.findByIdAndUpdate({ _id: userId }, { $set: { is_online: "1" } });

  // User Broadcast Online
  socket.broadcast.emit("getOnlineUser", { user_id: userId });

  socket.on("disconnect", async () => {
    console.log("User Disconnected");
    let userId = socket.handshake.auth.token;

    await User.findByIdAndUpdate({ _id: userId }, { $set: { is_online: "0" } });

    // User Broadcast Offline
    socket.broadcast.emit("getOfflineUser", { user_id: userId });
  });
  //Implementing Chat
  socket.on("newChat", (data) => {
    socket.broadcast.emit("loadNewChat", data);
  });

  //Load all chats in a conversation
  socket.on("existingChats", async (data) => {
    const chats = await Chat.find({
      $or: [
        {
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
        },
        {
          sender_id: data.receiver_id,
          receiver_id: data.sender_id,
        },
      ],
    });

    socket.emit("loadChats", { chats: chats });
  });
});

http.listen(process.env.PORT, () => {
  console.log("Server is running");
});
