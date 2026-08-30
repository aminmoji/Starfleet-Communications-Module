const crypto = require("crypto");
const mongoose = require("mongoose");

const ENCRYPTION_KEY = (() => {
  const rawKey = process.env.CHAT_ENCRYPTION_KEY || "starfleet-local-dev-chat-key-change-me";
  return crypto.createHash("sha256").update(rawKey).digest();
})();

function encryptText(value) {
  if (typeof value !== "string") {
    return value;
  }

  const cleanValue = value.trim();
  if (!cleanValue) {
    return cleanValue;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(cleanValue, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  try {
    const payload = Buffer.from(value, "base64");
    if (payload.length < 28) {
      return value;
    }

    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (error) {
    return value;
  }
}

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
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
      set: encryptText,
      get: decryptText,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

chatSchema.index({ sender_id: 1, receiver_id: 1, createdAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
module.exports.encryptText = encryptText;
module.exports.decryptText = decryptText;
