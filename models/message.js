const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatroom: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Chatroom",
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    text: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
