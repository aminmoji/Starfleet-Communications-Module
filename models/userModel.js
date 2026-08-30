const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
      match: /^[a-z0-9._-]+$/,
    },
    firstname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    lastname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    rank: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    image: {
      type: String,
      default: "/default-avatar.svg",
    },
    avatarData: {
      type: Buffer,
      select: false,
    },
    avatarContentType: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp"],
      select: false,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    is_online: {
      type: Boolean,
      default: false,
      index: true,
    },
    ship: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    species: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
