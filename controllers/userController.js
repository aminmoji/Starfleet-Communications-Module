const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { BlobServiceClient } = require("@azure/storage-blob");

const User = require("../models/userModel");
const Chat = require("../models/chatModel");

const DEFAULT_AVATAR = "/default-avatar.svg";
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

class InputError extends Error {}

function cleanField(value, label, { min = 1, max = 80, required = true } = {}) {
  const cleanValue = typeof value === "string" ? value.trim() : "";

  if (required && cleanValue.length < min) {
    throw new InputError(`${label} is required.`);
  }

  if (cleanValue && (cleanValue.length < min || cleanValue.length > max)) {
    throw new InputError(`${label} must be between ${min} and ${max} characters.`);
  }

  return cleanValue;
}

function normalizeUsername(value) {
  const username = cleanField(value, "Username", { min: 3, max: 32 }).toLowerCase();

  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new InputError("Username may use letters, numbers, dots, underscores, and hyphens.");
  }

  return username;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function uploadAvatar(file) {
  if (!file) {
    return null;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.CONTAINER_NAME;
  if (!connectionString || !containerName) {
    throw new InputError("Profile-image uploads are not configured on this deployment.");
  }

  const extension = IMAGE_EXTENSIONS[file.mimetype];
  const blobName = `${crypto.randomUUID()}.${extension}`;
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype,
      blobCacheControl: "public, max-age=31536000, immutable",
    },
  });

  return blockBlobClient.url;
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

function registerLoad(req, res) {
  res.render("register");
}

async function register(req, res) {
  try {
    const username = normalizeUsername(req.body.username);
    const password = cleanField(req.body.password, "Password", { min: 8, max: 128 });
    const existingUser = await User.exists({ username });

    if (existingUser) {
      return res.status(409).render("register", { message: "That username is already in use." });
    }

    const uploadedImage = await uploadAvatar(req.file);
    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      username,
      firstname: cleanField(req.body.firstname, "First name", { max: 60 }),
      lastname: cleanField(req.body.lastname, "Last name", { max: 60 }),
      password: passwordHash,
      ship: cleanField(req.body.ship, "Ship", { max: 80 }),
      species: cleanField(req.body.species, "Species", { max: 80 }),
      rank: cleanField(req.body.rank, "Rank", { max: 80 }),
      image: uploadedImage || DEFAULT_AVATAR,
    });

    return res.redirect("/login");
  } catch (error) {
    if (error instanceof InputError) {
      return res.status(400).render("register", { message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).render("register", { message: "That username is already in use." });
    }

    console.error("Registration failed", error);
    return res.status(500).render("register", { message: "Registration is temporarily unavailable." });
  }
}

function loadLogin(req, res) {
  res.render("login");
}

async function login(req, res) {
  try {
    const username = normalizeUsername(req.body.username);
    const password = cleanField(req.body.password, "Password", { min: 1, max: 128 });
    const user = await User.findOne({ username }).select("+password");
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

    if (!passwordMatches) {
      return res.status(401).render("login", {
        message: "The username or password is incorrect.",
      });
    }

    await regenerateSession(req);
    req.session.userId = String(user._id);
    return res.redirect("/dashboard");
  } catch (error) {
    if (error instanceof InputError) {
      return res.status(401).render("login", { message: "The username or password is incorrect." });
    }

    console.error("Login failed", error);
    return res.status(500).render("login", { message: "Login is temporarily unavailable." });
  }
}

async function logout(req, res) {
  await User.findByIdAndUpdate(req.session.userId, { is_online: false }).catch(() => {});
  await destroySession(req);
  res.clearCookie("starfleet.sid");
  return res.redirect("/login");
}

async function loadProfile(req, res) {
  const user = await User.findById(req.session.userId).lean();
  if (!user) {
    await destroySession(req);
    return res.redirect("/login");
  }

  return res.render("profile", { user });
}

async function editProfile(req, res) {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      await destroySession(req);
      return res.redirect("/login");
    }

    const username = req.body.username ? normalizeUsername(req.body.username) : user.username;
    if (username !== user.username && (await User.exists({ username }))) {
      return res.status(409).render("profile", {
        user: user.toObject(),
        message: "That username is already in use.",
      });
    }

    user.username = username;
    user.firstname = req.body.firstname
      ? cleanField(req.body.firstname, "First name", { max: 60 })
      : user.firstname;
    user.lastname = req.body.lastname
      ? cleanField(req.body.lastname, "Last name", { max: 60 })
      : user.lastname;
    user.rank = req.body.rank ? cleanField(req.body.rank, "Rank", { max: 80 }) : user.rank;
    user.ship = req.body.ship ? cleanField(req.body.ship, "Ship", { max: 80 }) : user.ship;
    user.species = req.body.species
      ? cleanField(req.body.species, "Species", { max: 80 })
      : user.species;

    if (req.body.password) {
      const password = cleanField(req.body.password, "Password", { min: 8, max: 128 });
      user.password = await bcrypt.hash(password, 12);
    }

    const uploadedImage = await uploadAvatar(req.file);
    if (uploadedImage) {
      user.image = uploadedImage;
    }

    await user.save();
    return res.redirect("/dashboard");
  } catch (error) {
    if (error instanceof InputError) {
      const user = await User.findById(req.session.userId).lean();
      return res.status(400).render("profile", { user, message: error.message });
    }

    console.error("Profile update failed", error);
    const user = await User.findById(req.session.userId).lean();
    return res.status(500).render("profile", {
      user,
      message: "Profile changes could not be saved.",
    });
  }
}

async function deleteProfile(req, res) {
  const userId = req.session.userId;
  await Promise.all([
    User.findByIdAndDelete(userId),
    Chat.deleteMany({ $or: [{ sender_id: userId }, { receiver_id: userId }] }),
  ]);
  await destroySession(req);
  res.clearCookie("starfleet.sid");
  return res.redirect("/login");
}

async function loadDashboard(req, res) {
  try {
    const user = await User.findById(req.session.userId).lean();
    if (!user) {
      await destroySession(req);
      return res.redirect("/login");
    }

    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 60) : "";
    const filter = { _id: { $ne: user._id } };

    if (query) {
      const search = new RegExp(escapeRegExp(query), "i");
      filter.$or = [
        { username: search },
        { firstname: search },
        { lastname: search },
        { rank: search },
        { ship: search },
        { species: search },
      ];
    }

    const users = await User.find(filter).sort({ is_online: -1, lastname: 1 }).lean();
    return res.render("dashboard", { user, users, query });
  } catch (error) {
    console.error("Dashboard failed", error);
    return res.status(500).render("login", {
      message: "Crew records are temporarily unavailable.",
    });
  }
}

module.exports = {
  deleteProfile,
  editProfile,
  loadDashboard,
  loadLogin,
  loadProfile,
  login,
  logout,
  register,
  registerLoad,
};
