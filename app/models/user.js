const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  name: {type: String, required: true},
  email: {type: String, required: true, unique: true},
  passwordhash: {type: String, required: true},
  codes: {type: [String], default: []}
});
UserSchema.index({name: 1, email: 1}, {text: true});

UserSchema.methods.validPassword = function(password) {
  return bcrypt
      .compare(password, this.passwordhash)
      .then(valid => valid ? this : Promise.reject(new Error('invalid password')))
};
UserSchema.methods.setPassword = function(password) {
  return bcrypt.hash(password, 8).then(hash => {
    this.passwordhash = hash;
    return this;
  });
};

UserSchema.set('toJSON', {
  versionKey: false,
  transform: (doc, ret) => {
    delete ret.passwordhash;
    delete ret.memberships;
    delete ret.codes;
  }
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
