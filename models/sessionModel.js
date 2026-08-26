const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    _id: String,
    session: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("Session", sessionSchema);
