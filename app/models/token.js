const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema(
    {email: {type: String, required: true}, token: {type: String}}, {_id: false});

const TokenSchema = new mongoose.Schema({
  type: {type: String, required: true, enum: ['User', 'Store', 'Recover']},
  capacity: {type: Number, min: 0, required: true, default: 1},
  log: {type: [LogSchema]},
  data: {}
});

TokenSchema.methods.consume = function(email, token) {
  this.log.push({email, token});
  this.capacity--;
  return this.save();
};

const Token = mongoose.model('Token', TokenSchema);
module.exports = Token;
