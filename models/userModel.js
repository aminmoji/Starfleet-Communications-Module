const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    rank: {
      type: String,
      required: true,
    },
    image: {
      filename: {
        type: String,
        required: true,
      },
      filepath: {
        type: String,
        requierd: true,
      },
    },
    password: {
      type: String,
      required: true,
    },
    is_online: {
      type: String,
      default: "0",
    },
    ship: {
      type: String,
      required: true,
    },
    species: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
