const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number,
    required: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  }
}, {
    timestamps: true
});

const File = mongoose.model("File", fileSchema);

module.exports = File;
