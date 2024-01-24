const { Schema, model } = require("mongoose");

const taskSchema = new Schema({
  createdAt: {
    type: Date,
    default: Date.now()
  },
  createdBy: {
    username: String,
    profilePicture: Number
  },
  body: String,
  state: {
    type: String,
    default: "to-do"
  },
  color: {
    type: Number,
    default: 0
  },
});

module.exports = model("task", taskSchema);
