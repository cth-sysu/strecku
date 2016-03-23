const config = require('config');
const cookieParser = require('socket.io-cookie-parser');
const passport = require('passport');

const auth = require('./auth');
const events = require('./events');

const io = require('socket.io')({
  path: '/api/streaming/v1'
});

io.use(cookieParser(config.secret));
io.use((socket, next) => auth.authenticate(socket.request, socket.request.res, next));
io.use((socket, next) => {
  socket.request.store = socket.request.user;
  delete socket.request.user;
  next();
});
io.on('connection', socket => socket.join(socket.request.store._id));

let actions = ['purchase'];
actions.forEach(action => events.on(action, (store, data) => io.to(store).emit(action, data)));

module.exports = server => io.attach(server);
