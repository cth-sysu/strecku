const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  email: {type: String, required: true},
  time: {type: Date, required: true, default: Date.now}
}, {_id: false});

const ImageSchema = new mongoose.Schema({
  contentType: {type: String},
  data: {type: Buffer},
  updatedAt: {type: [LogSchema]}
});

const Image = mongoose.model('Image', ImageSchema);
module.exports = Image;
