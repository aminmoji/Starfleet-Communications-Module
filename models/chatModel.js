const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ciphertext: {
      type: String,
      required: true,
      maxlength: 12000000,
    },
    iv: {
      type: String,
      required: true,
      maxlength: 64,
    },
    keyVersion: {
      type: Number,
      required: true,
    },
    attachment: {
      ciphertext: { type: String, maxlength: 12000000 },
      iv: { type: String, maxlength: 64 },
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ sender_id: 1, receiver_id: 1, createdAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
