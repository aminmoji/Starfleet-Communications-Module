const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const User = require("../models/userModel");
const Chat = require("../models/chatModel");

const DEFAULT_AVATAR = "/default-avatar.svg";

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

function hasValidImageSignature(file) {
  const bytes = file.buffer;

  if (file.mimetype === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (file.mimetype === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function attachAvatar(user, file) {
  if (!file) {
    return;
  }

  if (!hasValidImageSignature(file)) {
    throw new InputError("Profile image contents do not match the selected file type.");
  }

  user.avatarData = file.buffer;
  user.avatarContentType = file.mimetype;
  user.image = `/avatars/${user._id}?v=${Date.now()}`;
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

    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      username,
      firstname: cleanField(req.body.firstname, "First name", { max: 60 }),
      lastname: cleanField(req.body.lastname, "Last name", { max: 60 }),
      password: passwordHash,
      ship: cleanField(req.body.ship, "Ship", { max: 80 }),
      species: cleanField(req.body.species, "Species", { max: 80 }),
      rank: cleanField(req.body.rank, "Rank", { max: 80 }),
      image: DEFAULT_AVATAR,
    });
    attachAvatar(user, req.file);
    await user.save();

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

    attachAvatar(user, req.file);

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

async function loadAvatar(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(404).end();
    }

    const user = await User.findById(req.params.userId).select("+avatarData +avatarContentType");
    if (!user?.avatarData || !user.avatarContentType) {
      return res.status(404).end();
    }

    res.set({
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": user.avatarContentType,
      "Content-Length": String(user.avatarData.length),
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(user.avatarData);
  } catch (error) {
    console.error("Avatar load failed", error);
    return res.status(500).end();
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
  loadAvatar,
  loadDashboard,
  loadLogin,
  loadProfile,
  login,
  logout,
  register,
  registerLoad,
};
