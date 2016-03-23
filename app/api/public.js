const express = require('express');
const auth = require('../auth');

const User = require('../models/user');
const Store = require('../models/store');

const api = express.Router();

api.get('/users/:id/jwt', auth.dev, (req, res, next) => {
  User.findById(req.params.id)
      .exec()
      .then(user => user || Promise.reject(404))
      .then(user => auth.jwt(User.modelName, user.id, user.passwordhash))
      .then(jwt => res.send(jwt))
      .catch(err => next(err));
}, auth.next);
api.get('/stores/:id/jwt', auth.dev, (req, res, next) => {
  Store.findById(req.params.id)
      .exec()
      .then(store => store || Promise.reject(404))
      .then(store => auth.jwt(Store.modelName, store.id))
      .then(jwt => res.send(jwt))
      .catch(err => next(err));
}, auth.next);

api.get('/tokens/:token', auth.token(), (req, res, next) => {
  const type = req.token.type;
  const capacity = req.token.capacity;
  const total = capacity + req.token.__v;
  res.json({type, capacity, total});
});

api.use(auth.catch);

module.exports = api;
