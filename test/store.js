let jwt = require('jsonwebtoken');
let mongoose = require('mongoose');
let ObjectId = mongoose.Types.ObjectId;

let Token = require('../app/models/token');
let User = require('../app/models/user');
let Store = require('../app/models/store');
let Product = require('../app/models/product');
let Purchase = require('../app/models/purchase');

let chai = require('chai');
let expect = chai.expect;
let assert = chai.assert;

let server = require('../server');
let mail = require('./util/mail');

chai.use(require('chai-http'));
chai.use(require('chai-datetime'));

let jwtFor = user => {
  let payload = {type: user.constructor.modelName, id: user.id, passwordhash: user.passwordhash};
  return jwt.sign(payload, process.env.STRECKUSECRET, {issuer: 'strecku'});
};

let stringifyObjectIdInTransform = M => {
  let t = (M.schema.options.toJSON = M.schema.options.toJSON || {}).transform;
  M.schema.options.toJSON.transform = (d, r) => (r._id = d.id, t ? t(d, r) : r);
};

stringifyObjectIdInTransform(User);
stringifyObjectIdInTransform(Product);
stringifyObjectIdInTransform(Store);

describe('Stores', () => {
  let buymore = new Store({name: 'Buy More'});
  let kwikemart = new Store({name: 'Kwik-E-Mart'});

  let clean = () => Store.remove().exec();
  before(() => clean()
    .then(() => Promise.all([buymore.save(), kwikemart.save()])));
  after(() => clean());

  describe('GET /stores/:id', () => {
    it('should not GET store without access', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}`)
      .set('Authorization', jwtFor(kwikemart))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET store', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.contain.all.keys('_id', 'name', 'metadata');
      }));
    it('should GET this', () =>
      chai.request(server)
      .get('/api/v1/stores/this')
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal(buymore.toJSON());
      }));
  });
});

describe('Codes', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-', codes: [1]});
  let beer = new Product({name: 'Bärs', barcodes: [2]});
  let buymore = new Store({name: 'Buy More'});

  let clean = () => Promise.all([
    User.remove().exec(),
    Store.remove().exec(),
    Product.remove().exec()
  ]);
  before(() => clean()
    .then(() => adam.save())
    .then(() => beer.save())
    .then(() => {
      buymore.accesses.push({user: adam.id, level: 0, admin: true});
      buymore.range.push({product: beer.id, pricelevels: [2, 4]});
      return buymore.save();
    }));
  after(() => clean());

  describe('GET /codes/:code', () => {
    it('should not GET code object without access', () =>
      chai.request(server)
      .get(`/api/v1/codes/${3}`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not GET code object with unknown code', () =>
      chai.request(server)
      .get(`/api/v1/codes/${3}`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should GET user from code', () =>
      chai.request(server)
      .get(`/api/v1/codes/${1}`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('type', 'user');
        expect(res.body).to.have.property(res.body.type)
        .to.deep.equal(Object.assign(adam.toJSON(), {
          level: 0,
          admin: true
        }));
      }));
    it('should GET product from code', () =>
      chai.request(server)
      .get(`/api/v1/codes/${2}`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('type', 'product');
        expect(res.body).to.have.property(res.body.type).to.deep.equal(beer.toJSON());
      }));
  });
  describe('POST /users/:id/codes', () => {
    it('should not POST code without access', () =>
      chai.request(server)
      .post(`/api/v1/users/${adam.id}/codes`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not POST code without code', () =>
      chai.request(server)
      .post(`/api/v1/users/${adam.id}/codes`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST duplicate code', () =>
      chai.request(server)
      .post(`/api/v1/users/${adam.id}/codes`)
      .set('Authorization', jwtFor(buymore))
      .send({code: 1})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(409)));
    it('should POST code', () =>
      chai.request(server)
      .post(`/api/v1/users/${adam.id}/codes`)
      .set('Authorization', jwtFor(buymore))
      .send({code: 3})
      .then(res => expect(res).to.have.status(204)));
  });
});

describe('Products', () => {
  let coffee = new Product({name: 'Kaffe'}),
      beer = new Product({name: 'Bärs'});
  let buymore = new Store({name: 'Buy More'});

  let clean = () => Promise.all([
    Store.remove().exec(),
    Product.remove().exec()
  ]);
  before(() => clean()
    .then(() => Promise.all([coffee.save(), beer.save()]))
    .then(() => {
      buymore.range.push({product: coffee.id, pricelevels: [2, 4]});
      return buymore.save();
    }));
  after(() => clean());

  describe('GET /products', () => {
    it('should not GET products without access', () =>
      chai.request(server)
      .get(`/api/v1/products`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET products', () =>
      chai.request(server)
      .get(`/api/v1/products`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        let products = [
          Object.assign({
            pricelevels: [2, 4]
          }, coffee.toJSON())
        ];
        expect(res.body.products).to.be.an('array').with.lengthOf(1)
            .and.have.all.deep.members(products);
      }));
  });
});

describe('Purchases', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-'}),
      eve = new User({name: 'Eve', email: 'eve@strecku.com', passwordhash: '-'});
  let coffee = new Product({name: 'Kaffe'}),
      beer = new Product({name: 'Bärs'});
  let buymore = new Store({name: 'Buy More'});
  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let clean = () => Promise.all([
    User.remove().exec(),
    Store.remove().exec(),
    Product.remove().exec(),
    Purchase.remove().exec()
  ]);
  before(() => clean()
    .then(() => Promise.all([adam.save(), eve.save()]))
    .then(() => Promise.all([coffee.save(), beer.save()]))
    .then(() => {
      buymore.accesses.push({user: adam.id, level: 0, admin: true});
      buymore.range.push({product: coffee.id, pricelevels: [2, 4]});
      return buymore.save();
    })
    .then(() => Promise.all([
      new Purchase({store: buymore.id, user: adam.id, product: coffee.id, price: 8, time: yesterday}).save(),
      new Purchase({store: buymore.id, user: eve.id, product: coffee.id, price: 10}).save(),
    ])));
  after(() => clean());

  describe('GET /purchases', () => {
    it('should not GET purchases without access', () =>
      chai.request(server)
      .get(`/api/v1/purchases`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET purchases', () =>
      chai.request(server)
      .get(`/api/v1/purchases`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.purchases).to.be.an('array').with.lengthOf(2)
            .and.have.deep.property('[0].user').to.deep.equal(eve.toJSON());
      }));
  });
  describe('POST /purchases', () => {
    it('should not POST purchase without access', () =>
      chai.request(server)
      .post(`/api/v1/purchases`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not POST purchase without body', () =>
      chai.request(server)
      .post(`/api/v1/purchases`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST purchase without access', () =>
      chai.request(server)
      .post(`/api/v1/purchases`)
      .set('Authorization', jwtFor(buymore))
      .send({product: coffee.id, user: eve.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST purchase with invalid product', () =>
      chai.request(server)
      .post(`/api/v1/purchases`)
      .set('Authorization', jwtFor(buymore))
      .send({product: beer.id, user: adam.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should POST purchase', () =>
      chai.request(server)
      .post(`/api/v1/purchases`)
      .set('Authorization', jwtFor(buymore))
      .send({product: coffee.id, user: adam.id})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.all.keys('_id', 'user', 'store', 'product', 'price', 'time');
        expect(res.body).to.have.deep.property('store._id', buymore.id);
        expect(res.body).to.have.deep.property('user._id', adam.id);
        expect(res.body).to.have.deep.property('product._id', coffee.id);
        expect(res.body).to.have.property('price', 2);
        expect(new Date(res.body.time)).to.be.afterDate(yesterday);
        return Purchase.findByIdAndRemove(res.body._id).exec();
      }));
  });
  describe('GET /purchases/count', () => {
    it('should not GET purchases without access', () =>
      chai.request(server)
      .get(`/api/v1/purchases/count`)
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET purchases', () =>
      chai.request(server)
      .get(`/api/v1/purchases/count`)
      .set('Authorization', jwtFor(buymore))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({count: 2});
      }));
  });
});
