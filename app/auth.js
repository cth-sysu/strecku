const config = require('config')
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const passport = require('passport');
const send_mail = require('./mail');

const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;

const User = require('./models/user');
const Store = require('./models/store');
const Token = require('./models/token');

function local_validate(email, password, done) {
  return User.findOne({email: email.toLowerCase()})
      .exec()
      .then(user => user || Promise.reject())
      .then(user => user.validPassword(password))
      .then(user => done(null, user))
      .catch(err => done(err));
}
passport.use('local-user', new LocalStrategy(local_validate));

const jwt_from_request = (req) => {
  return (req.signedCookies || {}).jwt_session || req.get('authorization') ||
      (req.body || {}).authorization;
};
const jwt_options = {
  secretOrKey: config.secret,
  jwtFromRequest: jwt_from_request,
  issuer: 'strecku'
};
function jwt_validate(payload, done) {
  return mongoose.model(payload.type)
      .findById(payload.id)
      .exec()
      .then(subj => subj || Promise.reject())
      .then(subj => (!subj.passwordhash || subj.passwordhash == payload.passwordhash) && subj)
      .then(subj => done(null, subj))
      .catch(err => done(err));
}
passport.use(new JwtStrategy(jwt_options, jwt_validate));

const error = new Error('authentication error');
const auth = {
  error,
  cors(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD');
      res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Length, Content-Type, Origin, X-Requested-With');
      return res.status(200).end();
    }
    next();
  },
  dev: (req, res, next) => next(process.env.NODE_ENV == 'development' ? 0 : error),
  token: type => (req, res, next) => {
    const token = req.query.token || req.body.token || req.params.token;
    const query = Token.findById(jwt.verify(token, config.secret)).gt('capacity', 0);
    type && query.where('type', type);
    query.exec()
    .then(token => next((req.token = token) ? 0 : error))
    .catch(() => next(401));
  },
  me: (req, res, next) => next(req.params.id == req.user._id || req.params.id == 'me' ? 0 : error),
  this: (req, res, next) => next(req.params.id == req.store._id || req.params.id == 'this' ? 0 : error),
  store_admin: (req, res, next) =>
    Store.findById(req.params.id).admin(req.user).exec()
    .then(store => next((req.store = store) ? 0 : error))
    .catch(err => next(err)),
  user: (req, res, next) => next(req.user.constructor === User ? 0 : error),
  store: (req, res, next) => next(req.user.constructor === Store ? 0 : error),
  next: (err, req, res, next) => next(err === error ? 0 : err),
  catch(err, req, res, next) {
    if (typeof err === 'number' && (err % 1) === 0) {
      return res.status(err).end();
    } else if (typeof err === 'boolean') {
      return res.status(403).end();
    } else if (err === error) {
      return res.status(401).end();
    } else if (err && typeof err === 'object') {
      switch (err.name) {
        case 'MongoError':
          switch (err.code) {
            case 11000: return res.status(409).end();
          }
        case 'ValidationError':
        case 'CastError': return res.status(400).end();
        default: return res.status(500).end();
      }
    }
    return res.status(404).end();
  },
  // password management
  forgot: (req, res, next) => User.findOne({email: req.query.username.toLowerCase()}).exec()
    .then(user => user || Promise.reject(404))
    .then(user => auth.requestRecovery(user.id, user.email))
    .then(() => res.redirect('/login?success=recovery'))
    .catch(err => next(err)),
  requestRecovery: (id, email) =>
    new Token({type: 'Recover', capacity: 1, data: id}).save()
    .then(token => jwt.sign(token.id, config.secret, {issuer: 'strecku'}))
    .then(token => `${config.server}/recover?token=${token}`)
    .then(link => send_mail.passwordReset({ to: email }, { link })),
  recover: (req, res, next) =>
    User.findById(req.token.data).exec()
    .then(user => user || Promise.reject(500))
    .then(user => req.body.password ? user.setPassword(req.body.password) : Promise.reject(400))
    .then(user => user.save())
    .then(() => req.token.consume(user.email))
    .then(() => res.redirect('/login'))
    .catch(err => next(err)),
  // jwt
  authenticate: passport.authenticate('jwt', {session: false}),
  try: (strategy, successRedirect) => (req, res, next) =>
    passport.authenticate(strategy, (err, user) => {
      !err && user ? res.redirect(successRedirect) : next();
    })(req, res, next),
  jwt(type, id, passwordhash) {
    let payload = {type, id, passwordhash};
    return jwt.sign(payload, config.secret, {issuer: 'strecku'});
  },
  login(req, res, next) {
    const jwt_session = auth.jwt(req.user.constructor.modelName, req.user._id, req.user.passwordhash);
    res.cookie('jwt_session', jwt_session, {
      maxAge: 31536000000, // 1 year
      httpOnly: process.env.NODE_ENV !== 'development',
      secure: process.env.NODE_ENV !== 'development',
      signed: true
    });
    next();
  },
  logout: (req, res, next) =>{
    res.clearCookie('jwt_session')
    next();
  }
};

module.exports = auth;
