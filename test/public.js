const config = require('config');
let jwt = require('jsonwebtoken');
let mongoose = require('mongoose');
var rp = require('request-promise');
let ObjectId = mongoose.Types.ObjectId;

let Token = require('../app/models/token');
let User = require('../app/models/user');

let chai = require('chai');
let expect = chai.expect;
let assert = chai.assert;

let server = require('../server');
let mail = require('./util/mail');

chai.use(require('chai-http'));
chai.use(require('chai-datetime'));

let jwtToken = token => jwt.sign(token.id, config.secret);
let jwtUser = user => {
  let payload = {type: user.constructor.modelName, id: user.id, passwordhash: user.passwordhash};
  return jwt.sign(payload, config.secret, {issuer: 'strecku'});
};

let stringifyObjectIdInTransform = M => {
  let t = (M.schema.options.toJSON = M.schema.options.toJSON || {}).transform;
  M.schema.options.toJSON.transform = (d, r) => (r._id = d.id, t ? t(d, r) : r);
};

stringifyObjectIdInTransform(Token);

describe('Public', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-'});
  let user_token = new Token({type: 'User', capacity: 1});
  let store_token = new Token({type: 'Store', capacity: 1});
  let clean = () => Promise.all([
    User.remove().exec(),
    Token.remove().exec()
  ]);
  before(() => clean()
    .then(() => adam.setPassword('foo'))
    .then(() => Promise.all([
      adam.save(),
      user_token.save(),
      store_token.save()
    ])));
  afterEach(() => mail.reset());
  after(() => clean());
  describe('GET /jwt', () => {
    it('should not GET user jwt', () =>
      chai.request(server)
      .get(`/api/v1/users/${new ObjectId()}/jwt`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not GET store jwt', () =>
      chai.request(server)
      .get(`/api/v1/stores/${new ObjectId()}/jwt`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
  });
  describe('GET /tokens', () => {
    it('should GET token', () =>
      chai.request(server)
      .get(`/api/v1/tokens/${jwtToken(user_token)}`)
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({type: 'User', capacity: 1, total: 1});
      }));
  })
  describe('POST /signup & GET /activate', () => {
    const expectLoginError = res => expect(res).to.redirect &&
                                    /\/login\?error=/.test(res.redirects[0]);
    it('should not POST /signup without token', () =>
      chai.request(server)
      .post('/signup')
      .send()
      .then(res => expectLoginError(res)));
    it('should not POST /signup with store token', () =>
      chai.request(server)
      .post('/signup')
      .send({token: jwtToken(store_token)})
      .then(res => expectLoginError(res)));
    it('should not POST /signup with no email and password', () =>
      chai.request(server)
      .post('/signup')
      .send({token: jwtToken(user_token)})
      .then(res => expectLoginError(res)));
    it('should not POST /signup with email that already exists', () =>
      chai.request(server)
      .post('/signup')
      .send({token: jwtToken(user_token), email: adam.email, password: 'foo'})
      .then(res => expectLoginError(res)));
    const existing_user_activation_token = jwt.sign({
      name: adam.name,
      email: adam.email,
      passwordhash: adam.passwordhash
    }, config.secret);
    it('should not GET /activate with user that already exists', () =>
      chai.request(server)
      .get(`/activate?token=${existing_user_activation_token}`)
      .then(res => expectLoginError(res)));
    it('should POST /signup and GET /activate to create new user', () =>
      chai.request(server)
      .post('/signup')
      .send({token: jwtToken(user_token), name: 'bar', email: 'arbitrary@email.com', password: 'foo'})
      .then(res => expect(res).to.have.status(200))
      .then(() => {
        expect(mail.all).to.be.an('array').with.lengthOf(1);
        expect(mail.last.subject).to.be.equal('Activate your account');
        expect(mail.last.header.to).to.be.equal('arbitrary@email.com');
        expect(mail.last.data.link).to.match(/.*\/activate\?token=(\w|\.|-)+$/);
        return rp({
          uri: mail.last.data.link,
          followRedirect: false,
          resolveWithFullResponse: true,
          simple: false
        })
        .then(res => {
          expect(res.statusCode).to.equal(302);
          return User.findOne({email: 'arbitrary@email.com'}).exec();
        })
        .then(user => expect(user).to.not.be.null);
      }));
  });
  describe('PUT /update/email & GET /confirm', () => {
    it('should PUT email and GET /confirm to update email', () =>
      chai.request(server)
      .put('/update/email')
      .set('Authorization', jwtUser(adam))
      .send({email: 'adam@strecku.net'})
      .then(res => expect(res).to.have.status(204))
      .then(() => User.findById(adam.id).exec())
      .then(user => {
        expect(user.name).to.equal('Adam');
        expect(user.email).to.equal(adam.email);
      })
      .then(() => {
        expect(mail.all).to.be.an('array').with.lengthOf(1);
        expect(mail.last.subject).to.be.equal('Confirm email address');
        expect(mail.last.header.to).to.be.equal('adam@strecku.net');
        expect(mail.last.data.link).to.match(/.*\/confirm\?token=(\w|\.|-)+$/);
        return rp({
          uri: mail.last.data.link,
          followRedirect: false,
          resolveWithFullResponse: true,
          simple: false
        })
        .then(res => {
          expect(res.statusCode).to.equal(302);
          return User.findOne({email: 'adam@strecku.net'}).exec();
        })
        .then(user => expect(user).to.not.be.null);
      }));
  });
  describe('PUT /update/password', () => {
    it('should not PUT password without params', () =>
      chai.request(server)
      .put('/update/password')
      .set('Authorization', jwtUser(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not PUT same as current password', () =>
      chai.request(server)
      .put('/update/password')
      .set('Authorization', jwtUser(adam))
      .send({old: 'bar', password: 'bar'})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not PUT with invalid old password', () =>
      chai.request(server)
      .put('/update/password')
      .set('Authorization', jwtUser(adam))
      .send({old: 'bar', password: 'baz'})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should PUT new password', () =>
      chai.request(server)
      .put('/update/password')
      .set('Authorization', jwtUser(adam))
      .send({old: 'foo', password: 'bar'})
      .then(res => {
        expect(res).to.have.status(200);
        expect(res).to.have.header('set-cookie')
      })
      .then(() => User.findById(adam.id).exec())
      .then(user => user.validPassword('bar'))
      .catch(err => assert.fail(err)));
    after(() => adam.setPassword('foo')
      .then(() => adam.save()))
  });
});