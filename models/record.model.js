const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
  },
  post_date: {
    type: Date,
    required: true,
  },
  seen_time: {
    type: Date,
    required: true,
  },
});

// Create a compound index to enforce uniqueness on post_date and name
recordSchema.index({ post_date: 1, name: 1 }, { unique: true });

const Record = mongoose.model('Record', recordSchema);
module.exports = Record;
