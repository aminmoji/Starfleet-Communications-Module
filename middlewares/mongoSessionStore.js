const session = require("express-session");
const SessionModel = require("../models/sessionModel");

class MongoSessionStore extends session.Store {
  get(sessionId, callback) {
    SessionModel.findById(sessionId)
      .lean()
      .then((record) => callback(null, record?.session || null))
      .catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 8 * 60 * 60 * 1000);

    SessionModel.findByIdAndUpdate(
      sessionId,
      { session: sessionData, expiresAt },
      { upsert: true, runValidators: true }
    )
      .then(() => callback())
      .catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    SessionModel.findByIdAndDelete(sessionId)
      .then(() => callback())
      .catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 8 * 60 * 60 * 1000);

    SessionModel.findByIdAndUpdate(sessionId, { expiresAt })
      .then(() => callback())
      .catch(callback);
  }
}

module.exports = MongoSessionStore;
