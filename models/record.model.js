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

const Record = mongoose.model('Record', recordSchema);
module.exports = Record;
