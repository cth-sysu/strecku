const bcrypt = require('bcrypt');
const config = require('config');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

const auth = require('./auth');
const send_mail = require('./mail');

const User = require('./models/user');

const api = express.Router();

const auth_token = auth.token('User');

// Deprecated. Old emails may contain valid tokens with a link to here
api.get('/user', (req, res) => res.redirect(`/signup?token=${req.query.token || ''}`));

api.route('/signup')
.get(auth_token, (req, res) => res.sendFile(path.join(__dirname, '../static/private', 'signup.html')))
.post(auth_token, (req, res, next) => {
  if (!req.body.name || !req.body.email || !req.body.password) {
    return next(400);
  }
  let name = req.body.name;
  let email = req.body.email.toLowerCase();
  let password = req.body.password;
  User.count({email}).exec()
  .then(count => !count || Promise.reject(new Error('User already registered')))
  .then(() => bcrypt.hash(password, 8))
  .then(passwordhash => jwt.sign({name, email, passwordhash}, config.secret))
  .then(token => {
    const link = `${config.server}/activate?token=${token}`;
    return send_mail.userActivate({to: email}, {link})
    .then(() => req.token.consume(email, token));
  })
  .then(() => res.redirect('/login'))
  .catch(err => next(err));
});

const update = express.Router();
update.put('/email', auth.authenticate, (req, res, next) => {
  if (!req.body.email) {
    return next(400);
  }
  const email = req.body.email.toLowerCase();
  if (email === req.user.email) {
    return next(400);
  }
  const id = req.user.id;
  const token = jwt.sign({id, update: {$set: {email}}}, config.secret);
  const link = `${config.server}/confirm?token=${token}`;
  send_mail.emailConfirm({to: email}, {link})
  .then(() => res.status(204).end())
  .catch(err => next(err));
})
update.put('/password', auth.authenticate, (req, res, next) => {
  if (!req.body.old || req.body.password == req.body.old) {
    return next(400);
  }
  req.user.validPassword(req.body.old)
  .catch(() => Promise.reject(401))
  .then(user => user.setPassword(req.body.password))
  .then(user => user.save())
  .then(() => next())
  .catch(err => next(err));
}, auth.login, (req, res) => res.end());
update.use(auth.catch);
api.use('/update', update);

api.get('/activate', (req, res, next) => {
  const user = jwt.verify(req.query.token, config.secret);
  new User(user).save()
  .then(() => res.redirect('/login'))
  .catch(err => next(err));
});
api.get('/confirm', (req, res, next) => {
  const payload = jwt.verify(req.query.token, config.secret);
  User.findByIdAndUpdate(payload.id, payload.update).exec()
  .then(() => res.redirect('/login'))
  .catch(err => next(err));
});

module.exports = api;
