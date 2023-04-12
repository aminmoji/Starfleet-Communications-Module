const express = require("express");
const bcrypt = require("bcrypt");
const sessionsRouter = express.Router();
const User = require("../models/user");

//New / Login Page
sessionsRouter.get("/new", (req, res) => {
  res.render("sessions/new.ejs", {
    currentUser: req.session.checkUser,
  });
});

// New Chat
// sessionsRouter.get("/new_chat", (req, res) => {
//   res.render("sessions/new_chat.ejs", {
//     currentUser: req.session.checkUser,
//   });
// });

// Delete / Logout
sessionsRouter.delete("/", (req, res) => {
  req.session.destroy((error) => {
    res.redirect("/");
  });
});

// Create / Login
sessionsRouter.post("/", async (req, res) => {
  const checkUser = await User.findOne({
    username: req.body.username,
  });
  if (!checkUser) {
    res.send("No Crew Found");
  } else {
    const passwordMatches = bcrypt.compareSync(
      req.body.password,
      checkUser.password
    );
    if (passwordMatches) {
      req.session.currentUser = checkUser;
      res.redirect("/");
    } else {
      res.send("Invalid Credentials");
    }
  }
});

// Export
module.exports = sessionsRouter;
