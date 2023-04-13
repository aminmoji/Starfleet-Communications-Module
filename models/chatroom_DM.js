const mongoose = require("mongoose");

const chatroomSchema = new mongoose.Schema({
  name: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  users: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  messages: [
    {
      type: String,
      ref: "Message",
    },
  ],
});

const ChatroomDm = mongoose.model("ChatroomDm", chatroomSchema);

module.exports = ChatroomDm;
