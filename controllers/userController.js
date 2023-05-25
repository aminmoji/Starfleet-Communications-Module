const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const registerLoad = async (req, res) => {
  try {
    res.render("register");
  } catch (error) {
    console.log(error.message);
  }
};

const register = async (req, res) => {
  try {
    const checkUserName = await User.findOne({ username: req.body.username });
    if (checkUserName) {
      res.render("register", { message: "Username Already Exists." });
    } else {
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      const user = new User({
        username: req.body.username,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        image: {
          dataBin: fs.readFileSync(path.join("images/" + req.file.filename)),
        },
        password: passwordHash,
        ship: req.body.ship,
        species: req.body.species,
        rank: req.body.rank,
      });
      await user.save();
    }
    res.redirect("/login");
  } catch (error) {
    console.log("REgistration Error" + error.message);
  }
};

const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error.message);
  }
};

const login = async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;

    const userData = await User.findOne({
      username: username,
    });
    if (userData) {
      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (passwordMatch) {
        req.session.user = userData;
        res.redirect("/dashboard");
      } else {
        res.render("login", {
          message: "Username and Password are Incorrect!",
        });
      }
    } else {
      res.render("login", { message: "Username and Password are Incorrect!" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/");
  } catch (error) {
    console.log(error.message);
  }
};

const loadProfile = async (req, res) => {
  const editUser = await User.findById(req.session.user._id).exec();
  res.render("profile", {
    user: editUser,
  });
};

const editProfile = async (req, res) => {
  const update = {
    username: req.body.username,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    password: req.body.password,
    rank: req.body.rank,
    ship: req.body.ship,
    species: req.body.species,
  };

  if (req.file) {
    update.image = req.file.filename;
  }
  await User.findByIdAndUpdate(req.session.user._id, update);
  console.log(update);
  res.redirect("/dashboard");
};

const deleteProfile = async (req, res) => {
  await User.findByIdAndDelete(req.session.user._id);
  console.log("deleted");
  res.redirect("/login");
};

const loadDashboard = async (req, res) => {
  try {
    let users = await User.find({ _id: { $nin: [req.session.user._id] } });
    res.render("dashboard", {
      user: req.session.user,
      users: users,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const saveChat = async (req, res) => {
  try {
    const chat = new Chat({
      sender_id: req.body.sender_id,
      receiver_id: req.body.receiver_id,
      message: req.body.message,
    });
    var newChat = await chat.save();
    res
      .status(200)
      .send({ success: true, msg: "Chat inserted!", data: newChat });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
};

const lookUpCrew = async (req, res) => {
  try {
    const query = req.body.query;
    if (req.body.query.length) {
      const users = await User.find({
        _id: { $nin: req.session.user._id },
        $or: [
          {
            lastname: {
              $regex: query,
              $options: "i",
            },
          },
          {
            firstname: {
              $regex: query,
              $options: "i",
            },
          },
          {
            rank: {
              $regex: query,
              $options: "i",
            },
          },
          {
            ship: {
              $regex: query,
              $options: "i",
            },
          },
          {
            species: {
              $regex: query,
              $options: "i",
            },
          },
        ],
      });
      res.render("dashboardQuery", {
        users: users,
        user: req.session.user,
      });
    }
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  register,
  registerLoad,
  loadDashboard,
  login,
  loadLogin,
  logout,
  saveChat,
  lookUpCrew,
  loadProfile,
  editProfile,
  deleteProfile,
};
