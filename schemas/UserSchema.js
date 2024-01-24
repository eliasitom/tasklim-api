const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  username: {
    require: true,
    type: String,
    unique: true
  },
  password: {
    require: true,
    type: String
  },
  profilePicture: {
    type: Number,
    default: 0
  },
  friends: [
    {
      username: String,
      profilePicture: Number,
      state: String
    }
  ],
  notifications: [{
    from: String,
    to: String,
    notificationType: String,
    kanbanName: String // notificationType === "new kanban" => String, else => undefined
  }],
  sharedKanban: [{
    kanbanImage: Number,
    kanbanName: String
  }]
});

module.exports = model("user", userSchema);
