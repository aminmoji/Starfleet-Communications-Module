const express = require("express");
const bcrypt = require("bcrypt");
const sessionRouter = express.Router();
const User = require("../models/user");

//
sessionRouter.post("/", async (req, res) => {
  try {
    console.log(req.body);
    const username = await User.findOne({ username: req.body.username });
    if (!username) {
      return res.status(404).send({ message: "User Not Found!" });
    }
    const passwordIsValid = await bcrypt.compare(
      req.body.password,
      username.password
    );
    if (!passwordIsValid) {
      return res.status(401).send({ message: "Invalid Password!" });
    }
    if (passwordIsValid) {
      req.session.currentUser = username;
    }
    res.redirect("/");
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

module.exports = sessionRouter;
