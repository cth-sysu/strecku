const config = require('config');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const passport = require('passport');

const auth = require('./app/auth');

mongoose.connect(config.db.url);
mongoose.connection.on('error', err => console.error('database connection error:', err));
mongoose.Promise = Promise;

const app = express();

app.use(auth.cors);
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser(config.secret));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(passport.initialize());

// User account management endpoints
const account_management = require('./app/account_management');
app.use(account_management);

// API
const api = {
  public: require('./app/api/public'),
  store: require('./app/api/store'),
  user: require('./app/api/user'),
  private: require('./app/api/private'),
};
const not_found = (req, res, next) => res.status(404).end();
app.use('/api/v1', api.public, auth.authenticate,
        auth.store, api.store, auth.next,
        auth.user, api.user, auth.next,
        api.private, not_found);

// public
app.use(express.static(__dirname + '/static/public', {index: false}));

app.route('/forgot')
.get(auth.forgot);

app.route('/recover')
.get(auth.token('Recover'), (req, res) => res.sendFile(path.join(__dirname, '/static/public', 'recover.html')))
.post(auth.token('Recover'), auth.recover);

app.route('/login')
.get(auth.try('jwt', '/'), (req, res) => res.sendFile(path.join(__dirname, '/static/public', 'index.html')))
.post(passport.authenticate('local-user', {session: false, failureRedirect: '/login?error=login'}),
      auth.login,
      (req, res) => res.redirect('/'));

app.route('/logout')
.get(auth.logout, (req, res) => res.redirect('/login'));

app.get('*', passport.authenticate('jwt', {session: false, failureRedirect: '/login'}));
app.use((err, req, res, next) => res.redirect(`/login?error=${err}`));

// private
app.use(auth.authenticate);

// Shared static
app.use(express.static(__dirname + '/static/strecku'));

// Admin router
const admin = express.Router();
admin.get('*', (req, res) => res.sendFile(path.join(__dirname, '/static/strecku/admin', 'index.html')));
app.use('/admin/:id', auth.store_admin, admin, auth.next);

// Terminal router
const terminal = express.Router();
terminal.use(express.static(__dirname + '/static/strecku/terminal', {index: false}));
terminal.get('*', (req, res) => res.sendFile(path.join(__dirname, '/static/strecku/terminal', 'index.html')));
app.use(auth.store, terminal, auth.next);

// Client router
const client = express.Router();
client.use(express.static(__dirname + '/static/strecku/client', {index: false}));
client.get('*', (req, res) => res.sendFile(path.join(__dirname, '/static/strecku/client', 'index.html')));
app.use(client);

const server = app.listen(5100, 'localhost');

// Terminal socket
require('./app/terminal')(server);

module.exports = app;
