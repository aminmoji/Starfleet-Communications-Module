const mongoose = require("mongoose");
const express = require("express");
const chatroomRouter = express.Router();
const Chatroom = require("../models/chatroom_DM");
const User = require("../models/user");

chatroomRouter.get("/chat/:id", async (req, res) => {
  try {
    const currentUser = req.session.currentUser;
    const userId = await User.findById(req.params.id).exec();
    const chatroomExists = await Chatroom.findOne({
      users: { $all: [currentUser._id, userId._id] },
    });
    if (!chatroomExists) {
      const newChatRoom = new Chatroom({
        users: [currentUser._id, userId._id],
      });
      newChatRoom.save().then(
        res.render("chat.ejs", {
          currentUser: req.session.currentUser,
          otherUser: userId,
          newChatRoom,
        })
      );
    } else {
      const findChatroom = await Chatroom.findOne({
        users: [currentUser._id, userId._id],
      }).then(
        res.render("chat.ejs", {
          currentUser: req.session.currentUser,
          otherUser: userId,
          findChatroom,
        })
      );
    }
  } catch (err) {
    console.log(err.message);
  }
});

module.exports = chatroomRouter;
