const config = require('config');
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
  return jwt.sign(payload, config.secret, {issuer: 'strecku'});
};

let stringifyObjectIdInTransform = M => {
  let t = (M.schema.options.toJSON = M.schema.options.toJSON || {}).transform;
  M.schema.options.toJSON.transform = (d, r) => (r._id = d.id, t ? t(d, r) : r);
};

stringifyObjectIdInTransform(User);
stringifyObjectIdInTransform(Product);

describe('Token', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-'});
  let clean = () => User.remove().exec();
  before(() => clean().then(() => adam.save()));
  after(() => clean());
  afterEach(() => mail.reset());
  describe('POST /tokens', () => {
    it('should not POST token without email', () =>
      chai.request(server)
      .post('/api/v1/tokens')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should POST token', () =>
      chai.request(server)
      .post('/api/v1/tokens')
      .set('Authorization', jwtFor(adam))
      .send({email: 'arbitrary@email.com'})
      .then(res => {
        expect(res).to.have.status(200);
        expect(mail.all).to.be.an('array').with.lengthOf(1);
        expect(mail.last.subject).to.be.equal('Create user account');
        expect(mail.last.header.to).to.be.equal('arbitrary@email.com');
        expect(mail.last.data.link).to.exist;
      }));
  });
});

describe('Users', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-', codes: [1, 2]}),
      eve = new User({name: 'Eve', email: 'eve@strecku.com', passwordhash: '-'});
  let clean = () => Promise.all([
    User.remove().exec(),
    Store.remove().exec(),
    Token.remove().exec()
  ]);
  before(() => clean()
    .then(() => adam.setPassword('foo'))
    .then(() => Promise.all([adam.save(), eve.save()]))
    .then(() => {
      let store = new Store({name: 'store'});
      store.accesses.push({user: adam.id, level: 0, admin: true});
      store.accesses.push({user: eve.id, level: 0});
      return store.save();
    }));
  after(() => clean());
  describe('GET /users', () => {
    it('should not GET users (unauthorized)', () =>
      chai.request(server)
      .get('/api/v1/users')
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET users (admin)', () =>
      chai.request(server)
      .get('/api/v1/users')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.users).to.be.an('array').with.lengthOf(2)
            .and.have.all.deep.members([adam.toJSON(), eve.toJSON()]);
      }));
  });
  describe('GET /users/:id', () => {
    it('should GET user by id (admin)', () =>
      chai.request(server)
      .get(`/api/v1/users/${eve.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal(eve.toJSON());
      }));
    it('should GET me (non admin)', () =>
      chai.request(server)
      .get('/api/v1/users/me')
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal(eve.toJSON());
      }));
    it('should GET me (admin)', () =>
      chai.request(server)
      .get('/api/v1/users/me')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal(adam.toJSON());
      }));
  });
  describe('PUT /users/:id', () => {
    it('should not PUT user without params', () =>
      chai.request(server)
      .put('/api/v1/users/me')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should PUT user with name', () =>
      chai.request(server)
      .put('/api/v1/users/me')
      .set('Authorization', jwtFor(adam))
      .send({name: 'badam', email: adam.email})
      .then(res => expect(res).to.have.status(204))
      .then(() => User.findById(adam.id).exec())
      .then(user => {
        expect(user.name).to.be.equal('badam');
        expect(user.email).to.be.equal(adam.email);
        expect(mail.all).to.be.an('array').and.empty;
      }));
  });
  describe('POST /users/:id/recover', () => {
    it('should POST recover mail', () => 
      chai.request(server)
      .post('/api/v1/users/me/recover')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(mail.all).to.be.an('array').with.lengthOf(1);
        expect(mail.last.subject).to.be.equal('Password reset');
        expect(mail.last.header.to).to.be.equal(adam.email);
        expect(mail.last.data.link).to.exist;
      }));
    after(() => mail.reset());
  });
  describe('GET /users/:id/codes', () => {
    it('should GET codes', () =>
      chai.request(server)
      .get('/api/v1/users/me/codes')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.codes).to.be.an('array').with.lengthOf(2)
            .and.have.all.members([2, 1]);
      }));
  });
  describe('POST /users/:id/codes', () => {
    it('should not POST code without params', () =>
      chai.request(server)
      .post('/api/v1/users/me/codes')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST duplicate code', () =>
      chai.request(server)
      .post('/api/v1/users/me/codes')
      .set('Authorization', jwtFor(adam))
      .send({code: adam.codes[0]})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(409))
      .then(() => User.findById(adam.id).exec())
      .then(user => expect(user.codes.toObject()).and.have.all.members([2, 1])));
    it('should POST code', () =>
      chai.request(server)
      .post('/api/v1/users/me/codes')
      .set('Authorization', jwtFor(adam))
      .send({code: 3})
      .then(res => expect(res).to.have.status(204))
      .then(() => User.findById(adam.id).exec())
      .then(user => expect(user.codes.toObject()).and.have.all.members([2, 1, 3])));
  });
  describe('DELETE /users/:id/codes/:code', () => {
    it('should DELETE code', () =>
      chai.request(server)
      .delete('/api/v1/users/me/codes/1')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => expect(res).to.have.status(204))
      .then(() => User.findById(adam.id).exec())
      .then(user => expect(user.codes.toObject()).and.have.all.members([2, 3])));
  });
  describe('GET /users/:id/token', () => {
    it('should GET token', () =>
      chai.request(server)
      .get('/api/v1/users/me/token')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.token).to.equal(jwtFor(adam));
      }));
  })
});

describe('Product & Purchases', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-'}),
      eve = new User({name: 'Eve', email: 'eve@strecku.com', passwordhash: '-'});
  let coffee = new Product({name: 'Kaffe'}),
      beer = new Product({name: 'Bärs'});
  let store = new Store({name: 'store'});
  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let clean = () => Promise.all([
    User.remove().exec(),
    Store.remove().exec(),
    Product.remove().exec()
  ]);
  before(() => clean()
    .then(() => Promise.all([adam.save(), eve.save()]))
    .then(() => Promise.all([coffee.save(), beer.save()]))
    .then(() => {
      store.accesses.push({user: adam.id, level: 0, admin: true});
      store.accesses.push({user: eve.id, level: 1});
      return store.save();
    })
    .then(() => Promise.all([
      new Purchase({store: store.id, user: adam.id, product: beer.id, price: 10}).save(),
      new Purchase({store: store.id, user: adam.id, product: coffee.id, price: 20}).save(),
      new Purchase({store: store.id, user: eve.id, product: coffee.id, price: 30}).save(),
    ]))
    .then(() =>
      new Purchase({store: store.id, user: eve.id, product: coffee.id, price: 40, time: yesterday}).save()));
  after(() => clean());
  describe('GET /products', () => {
    it('should GET products (admin)', () =>
      chai.request(server)
      .get('/api/v1/products')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.products).to.be.an('array').with.lengthOf(2)
            .and.have.all.deep.members([coffee.toJSON(), beer.toJSON()]);
      }));
    it('should GET products (search and sort)', () =>
      chai.request(server)
      .get('/api/v1/products?search=bärs&limit=1')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        let expected = Object.assign({score: res.body.products[0].score}, beer.toJSON());
        expect(res.body.products).to.be.an('array').with.lengthOf(1)
            .and.have.all.deep.members([expected]);
      }));
  });
  describe('GET /products/:id', () => {
    it('should not GET unexisting product (admin)', () =>
      chai.request(server)
      .get(`/api/v1/products/${new ObjectId()}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should GET product (admin)', () =>
      chai.request(server)
      .get(`/api/v1/products/${beer.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal(beer.toJSON());
      }));
  });
  describe('GET /purchases', () => {
    it('should GET purchases', () =>
      chai.request(server)
      .get('/api/v1/purchases')
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.purchases).to.be.an('array').with.lengthOf(2)
            .and.have.deep.property('[0].user').to.deep.equal(eve.toJSON());
        let purchase = res.body.purchases[0];
        expect(purchase).to.have.all.keys('_id', 'user', 'store', 'product', 'price', 'time');
        expect(purchase).to.have.deep.property('store.name', store.name);
        expect(purchase).to.have.deep.property('product.name', coffee.name);
        expect(purchase).to.have.property('price').above(0);
        expect(new Date(purchase.time)).to.be.afterDate(yesterday);
      }));
    it('should GET purchases (default sort time, most recent first)', () =>
      chai.request(server)
      .get('/api/v1/purchases')
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.purchases).to.have.deep.property('[0].price', 30);
        expect(res.body.purchases).to.have.deep.property('[1].price', 40);
      }));
  });
  describe('GET /purchases/count', () => {
    it('should GET purchase count', () =>
      chai.request(server)
      .get('/api/v1/purchases/count')
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({count: 2});
      }));
  });
});

describe('Stores', () => {
  let adam = new User({name: 'Adam', email: 'adam@strecku.com', passwordhash: '-'}),
      eve = new User({name: 'Eve', email: 'eve@strecku.com', passwordhash: '-'}),
      steffe = new User({name: 'Steffe B', email: 'steffe@strecku.com', passwordhash: '-'})
  let coffee = new Product({name: 'Kaffe'}),
      beer = new Product({name: 'Bärs'}),
      pizza = new Product({name: 'Pizza'});
  let buymore = new Store({name: 'Buy More'});
  let kwikemart = new Store({name: 'Kwik-E-Mart'});
  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let day_before_yesterday = new Date();
  day_before_yesterday.setDate(day_before_yesterday.getDate() - 2);

  let clean = () => Promise.all([
    User.remove().exec(),
    Store.remove().exec(),
    Product.remove().exec(),
    Purchase.remove().exec()
  ]);
  before(() => clean()
    .then(() => Promise.all([adam.save(), eve.save(), steffe.save()]))
    .then(() => Promise.all([coffee.save(), beer.save(), pizza.save()]))
    .then(() => {
      buymore.accesses.push({user: adam.id, level: 0, admin: true});
      buymore.accesses.push({user: eve.id, level: 1, admin: false});
      buymore.range.push({product: coffee.id, pricelevels: [2, 4]});
      buymore.range.push({product: pizza.id, pricelevels: [9], available: false});
      return buymore.save();
    })
    .then(() => {
      kwikemart.accesses.push({user: eve.id, level: 1, admin: true});
      return kwikemart.save();
    })
    .then(() => new Purchase({store: buymore.id, user: adam.id, product: coffee.id, price: 8}).save())
    .then(() => new Purchase({store: buymore.id, user: eve.id, product: coffee.id, price: 10}).save()));
  after(() => clean());

  describe('GET /stores', () => {
    it('should GET stores', () =>
      chai.request(server)
      .get('/api/v1/stores')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.stores).to.be.an('array').with.lengthOf(1);
        let store = res.body.stores[0];
        expect(store).to.contain.all.keys('_id', 'name', 'purchases');
        expect(store).to.have.property('debt', 8);
        expect(store).to.have.property('admin', true);
        expect(store.purchases).to.have.property('count', 1);
        expect(new Date(store.purchases.latest)).to.be.afterDate(yesterday);
      }));
    it('should GET stores (mixed access types)', () =>
      chai.request(server)
      .get('/api/v1/stores')
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.stores).to.be.an('array').with.lengthOf(2);
        expect(res.body.stores[0]).to.contain.all.keys('_id', 'name', 'debt', 'admin', 'purchases');
      }));
  });
  describe('POST /stores', () => {
    it('should not POST store without name', () =>
      chai.request(server)
      .post('/api/v1/stores')
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should POST store', () =>
      chai.request(server)
      .post('/api/v1/stores')
      .set('Authorization', jwtFor(adam))
      .send({name: 'foo'})
      .then(res => {
        expect(res).to.have.status(201);
        Store.count({name: 'foo'}).exec()
        .then(count => expect(count).to.be.above(0));
      }));
  });
  describe('GET /stores/:id', () => {
    it('should not GET store without access', () =>
      chai.request(server)
      .get(`/api/v1/stores/${kwikemart.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should GET store', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.contain.all.keys('_id', 'name', 'purchases');
        expect(res.body).to.have.property('debt', 10);
        expect(res.body).to.have.property('admin', false);
        expect(res.body.purchases).to.have.property('count', 1);
        expect(new Date(res.body.purchases.latest)).to.be.afterDate(yesterday);
      }));
  });
  describe('PUT /stores/:id', () => {
    it('should not PUT store (non admin)', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}`)
      .set('Authorization', jwtFor(eve))
      .send({name: 'Buyless'})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should PUT store', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}`)
      .set('Authorization', jwtFor(adam))
      .send({name: 'Buyless'})
      .then(res => expect(res).to.have.status(204))
      .then(() => Store.findById(buymore._id).exec())
      .then(store => expect(store).to.have.property('name', 'Buyless')));
    after(() => Store.findById(buymore.id).exec()
      .then(store => {
        store.name = 'Buy More';
        return store.save();
      }));
  });
  describe('GET /stores/:id/users', () => {
    it('should GET store users with debt', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/users`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.users).to.be.an('array').with.lengthOf(2);
        expect(res.body.users[0]).to.contain.all.keys('_id', 'name', 'email', 'access', 'purchases');
        expect(res.body.users[0].purchases).to.contain.all.keys('count', 'latest')
      }));
  });
  describe('GET /stores/:id/accesses', () => {
    it('should not GET store accesses (non admin)', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET store accesses', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.accesses).to.be.an('array').with.lengthOf(2);
        expect(res.body.accesses[0]).to.contain.all.keys('_id', 'name', 'email', 'level', 'admin');
      }));
  });
  describe('POST /stores/:id/accesses', () => {
    it('should not POST store access without params', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store access with negative level', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(adam))
      .send({level: -1})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store access without user', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(adam))
      .send({level: 0})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST for existing store access', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(adam))
      .send({level: 1, user: eve.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(409)));
    it('should POST store access', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/accesses`)
      .set('Authorization', jwtFor(adam))
      .send({level: 0, user: steffe.id})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.deep.equal(Object.assign(steffe.toJSON(), {
          level: 0,
          admin: false
        }));
      }));
    after(() => Store.findById(buymore.id).exec()
      .then(store => {
        let access = store.accesses.find(access => access.user.equals(steffe._id));
        store.accesses.pull(access);
        return store.save();
      }));
  });
  describe('PUT /stores/:id/accesses/:id', () => {
    before(() => {
      buymore.accesses.push({user: steffe.id, level: 0});
      return buymore.save();
    });
    it('should not PUT unexisting store access', () =>
      chai.request(server)
      .put(`/api/v1/stores/${kwikemart.id}/accesses/${steffe.id}`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should not PUT store access with negative level', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/accesses/${steffe.id}`)
      .set('Authorization', jwtFor(adam))
      .send({level: -1})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should PUT store access', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/accesses/${steffe.id}`)
      .set('Authorization', jwtFor(adam))
      .send({level: 1, admin: true})
      .then(res => expect(res).to.have.status(204))
      .then(() => Store.findById(buymore._id).exec())
      .then(store => store.accesses.find(access => access.user == steffe.id))
      .then(access => {
        expect(access).to.have.property('level', 1);
        expect(access).to.have.property('admin', true);
      }));
    after(() => Store.findById(buymore.id).exec()
      .then(store => {
        let access = store.accesses.find(access => access.user == steffe.id);
        store.accesses.pull(access);
        return store.save();
      }));
  });
  describe('DELETE /stores/:id/accesses/:id', () => {
    before(() => {
      buymore.accesses.push({user: steffe.id, level: 0});
      return buymore.save();
    });
    it('should not DELETE unexisting store access', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${kwikemart.id}/accesses/${steffe.id}`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should not DELETE last admin access', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${kwikemart.id}/accesses/${eve.id}`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(412)));
    it('should DELETE store access', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${buymore.id}/accesses/${steffe.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('_id', steffe.id);
      }));
  });
  describe('GET /stores/:id/products', () => {
    it('should not GET store products from unexisting store', () =>
      chai.request(server)
      .get(`/api/v1/stores/${new ObjectId()}/products`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should not GET store products without access', () =>
      chai.request(server)
      .get(`/api/v1/stores/${kwikemart.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should GET store products (non admin)', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        let products = [
          Object.assign({
            price: 4,
            popularity: res.body.products[0].popularity
          }, coffee.toJSON())
        ];
        expect(res.body.products).to.be.an('array').with.lengthOf(1)
            .and.have.all.deep.members(products);
      }));
    it('should GET store products (admin)', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        let products = [
          Object.assign({
            price: 2,
            pricelevels: [2, 4],
            popularity: res.body.products[0].popularity,
            available: true
          }, coffee.toJSON()),
          Object.assign({
            price: 9,
            pricelevels: [9],
            popularity: res.body.products[1].popularity,
            available: false
          }, pizza.toJSON())
        ];
        expect(res.body.products).to.be.an('array').with.length.at.least(1)
            .and.have.all.deep.members(products);
      }));
  });
  describe('POST /stores/:id/products', () => {
    it('should not POST store product (non admin)', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not POST store product without params', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store product without product', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [3, 6]})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store product with non existing product', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [3, 6], product: new ObjectId()})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store product with already added product', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [3, 6], product: coffee.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(409)));
    it('should not POST store product with empty pricelevels', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [], name: 'Cigg'})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should POST store product with new product', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [3, 6], name: 'Cigg'})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.contain.all.keys('_id', 'name', 'metadata', 'barcodes', 'pricelevels', 'available');
        expect(res.body).to.have.property('name', 'Cigg');
        expect(res.body).to.have.property('pricelevels').to.deep.equal([3, 6]);
      }));
    it('should POST store product with existing product', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/products`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [4, 8], product: beer.id})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.contain.all.keys('_id', 'name', 'metadata', 'barcodes', 'pricelevels', 'available');
        expect(res.body).to.have.property('name', beer.name);
        expect(res.body).to.have.property('pricelevels').to.deep.equal([4, 8]);
      }));
    after(() => Promise.all([
        Store.findById(buymore.id).exec(),
        Product.find({name: 'Cigg'}).exec()
      ])
      .then(([store, [cigg]]) => {
        let items = [
          store.range.find(item => item.product == cigg.id),
          store.range.find(item => item.product == beer.id)
        ];
        items.forEach(item => store.range.pull(item));
        return Promise.all([
          store.save(),
          cigg.remove()
        ]);
      }));
  });
  describe('GET /stores/:id/products/:id', () => {
    it('should not GET store product (non admin)', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/products/${coffee.id}`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not GET unexisting store product', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/products/${beer.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should GET store product', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/products/${coffee.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.contain.all.keys('_id', 'name', 'metadata', 'barcodes', 'pricelevels', 'available');
        expect(res.body).to.have.property('name', coffee.name);
        expect(res.body).to.have.property('pricelevels').to.deep.equal([2, 4]);
        expect(res.body).to.have.property('available').to.deep.equal(true);
      }));
  });
  describe('PUT /stores/:id/products/:id', () => {
    it('should not PUT store product (non admin)', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/products/${coffee.id}`)
      .set('Authorization', jwtFor(eve))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not PUT store product without params', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/products/${coffee.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not PUT store product with non existing product', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/products/${new ObjectId()}`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [4, 8]})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should not PUT store product with empty pricelevels', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/products/${coffee.id}`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: []})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should PUT store product', () =>
      chai.request(server)
      .put(`/api/v1/stores/${buymore.id}/products/${coffee.id}`)
      .set('Authorization', jwtFor(adam))
      .send({pricelevels: [4, 8], available: false})
      .then(res => expect(res).to.have.status(204))
      .then(() => Store.findById(buymore.id).exec())
      .then(store => {
        let item = store.range.find(item => item.product == coffee.id).toJSON();
        expect(item).to.have.property('pricelevels').to.deep.equal([4, 8]);
        expect(item).to.have.property('available', false);
      }));
    after(() => Store.findById(buymore.id).exec()
      .then(store => {
        let item = store.range.find(item => item.product == coffee.id);
        item.pricelevels = [2, 4];
        item.available = true;
        return store.save();
      }));
  });
  describe('DELETE /stores/:id/products/:id', () => {
    let cigg = new Product({name: 'Cigg'});
    before(() => {
      buymore.range.push({product: cigg.id, pricelevels: [4, 8], available: false});
      return buymore.save();
    });
    it('should not DELETE unexisting store item', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${buymore.id}/products/${new ObjectId()}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should DELETE store product', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${buymore.id}/products/${cigg.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => expect(res).to.have.status(204))
      .then(() => Store.findById(buymore.id).exec())
      .then(store => expect(store.range).to.have.length.at.least(1)));
  });
  describe('GET /stores/:id/purchases', () => {
    it('should GET store purchases', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.purchases).to.be.an('array').with.lengthOf(2)
            .and.have.deep.property('[0].user').to.deep.equal(eve.toJSON());
        let purchase = res.body.purchases[0];
        expect(purchase).to.have.all.keys('_id', 'user', 'store', 'product', 'price', 'time');
        expect(purchase).to.have.deep.property('store.name', buymore.name);
        expect(purchase).to.have.deep.property('product.name', coffee.name);
        expect(purchase).to.have.property('price').above(0);
        expect(new Date(purchase.time)).to.be.afterDate(yesterday);
      }));
  });
  describe('POST /stores/:id/purchases', () => {
    it('should not POST store purchase without params', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store purchase to unexisting store', () =>
      chai.request(server)
      .post(`/api/v1/stores/${new ObjectId()}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send({product: beer.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should not POST store purchase without access', () =>
      chai.request(server)
      .post(`/api/v1/stores/${kwikemart.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send({product: beer.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(401)));
    it('should not POST store purchase with product not in range', () =>
      chai.request(server)
      .post(`/api/v1/stores/${kwikemart.id}/purchases`)
      .set('Authorization', jwtFor(eve))
      .send({product: beer.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store purchase with non availble product', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(eve))
      .send({product: pizza.id})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store purchase with custom product as non admin', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(eve))
      .send({product: 'Custom'})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should not POST store purchase with custom product without price', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send({product: 'Custom'})
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(400)));
    it('should POST store purchase (non admin)', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(eve))
      .send({product: coffee.id})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.all.keys('_id', 'user', 'store', 'product', 'price', 'time');
        expect(res.body).to.have.deep.property('store._id', buymore.id);
        expect(res.body).to.have.deep.property('user._id', eve.id);
        expect(res.body).to.have.deep.property('product._id', coffee.id);
        expect(res.body).to.have.property('price', 4);
        expect(new Date(res.body.time)).to.be.afterDate(yesterday);
      }));
    it('should POST store purchase (admin)', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send({product: coffee.id, user: eve.id, price: 6})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.all.keys('_id', 'user', 'store', 'product', 'price', 'time');
        expect(res.body).to.have.deep.property('store._id', buymore.id);
        expect(res.body).to.have.deep.property('user._id', eve.id);
        expect(res.body).to.have.deep.property('product._id', coffee.id);
        expect(res.body).to.have.property('price', 6);
        expect(new Date(res.body.time)).to.be.afterDate(yesterday);
      }));
    it('should POST store purchase with non availble product (admin)', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send({product: pizza.id})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.all.keys('_id', 'user', 'store', 'product', 'price', 'time');
        expect(res.body).to.have.deep.property('store._id', buymore.id);
        expect(res.body).to.have.deep.property('user._id', adam.id);
        expect(res.body).to.have.deep.property('product._id', pizza.id);
        expect(res.body).to.have.property('price', 9);
        expect(new Date(res.body.time)).to.be.afterDate(yesterday);
      }));
    it('should POST store purchase with custom product (admin)', () =>
      chai.request(server)
      .post(`/api/v1/stores/${buymore.id}/purchases`)
      .set('Authorization', jwtFor(adam))
      .send({product: 'Custom', user: eve.id, price: 8, time: day_before_yesterday})
      .then(res => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.all.keys('_id', 'user', 'store', 'note', 'price', 'time');
        expect(res.body).to.have.deep.property('store._id', buymore.id);
        expect(res.body).to.have.deep.property('user._id', eve.id);
        expect(res.body).to.have.property('note', 'Custom');
        expect(res.body).to.have.property('price', 8);
        expect(new Date(res.body.time)).to.be.beforeDate(yesterday);
      }));
  });
  describe('DELETE /stores/:id/purchases/:id', () => {
    let purchase = new Purchase({store: buymore.id, user: eve.id, product: beer.id, price: 6});
    before(() => purchase.save());
    it('should not DELETE unexisting store purchase', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${buymore.id}/purchases/${new ObjectId()}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => assert.fail('should not resolve'))
      .catch(err => expect(err).to.have.status(404)));
    it('should DELETE store purchase', () =>
      chai.request(server)
      .delete(`/api/v1/stores/${buymore.id}/purchases/${purchase.id}`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => expect(res).to.have.status(204))
      .then(() => Purchase.count().exec())
      .then(count => expect(count).to.equal(6)));
  });
  describe('GET /stores/:id/purchases/count', () => {
    it('should GET store purchase count', () =>
      chai.request(server)
      .get(`/api/v1/stores/${buymore.id}/purchases/count`)
      .set('Authorization', jwtFor(adam))
      .send()
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({count: 6});
      }));
  });
});
