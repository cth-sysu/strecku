const config = require('config');
const express = require('express');
const jwt = require('jsonwebtoken');
const rp = require('request-promise');
const auth = require('../auth');
const send_mail = require('../mail');
const store_events = require('../events');

const User = require('../models/user');
const Store = require('../models/store');
const Product = require('../models/product');
const Purchase = require('../models/purchase');
const Token = require('../models/token');

const api = express.Router();

api.route('/tokens')
.post((req, res, next) => {
  if (!req.body.email) {
    return next(400);
  }
  let type = User.modelName;
  let capacity = req.body.capacity || 1;
  let email = req.body.email.toLowerCase();
  new Token({type, capacity}).save()
  .then(doc => jwt.sign(doc.id, config.secret))
  .then(token => `${config.server}/signup?token=${token}`)
  .then(link => send_mail.userInvite(capacity, {to: email}, {link, capacity}))
  .then(() => res.status(201).redirect('/invite?success'))
  .catch(err => next(err));
});

// -------------------------------------------------------------------------------------------------
//    U S E R
// -------------------------------------------------------------------------------------------------

function nextPageLink(path, query) {
  const limit = parseInt(query.limit || 25);
  const next_offset = parseInt(query.offset || 0) + limit;
  return `${config.server}/api/v1${path}?limit=${limit}&offset=${next_offset}`;
}

api.route('/users')
.get((req, res, next) => {
  let opt, sort;
  if (req.query.search) {
    opt = {$text: {$search: req.query.search}};
    sort = {score: {$meta: 'textScore'}};
  }
  User.find(opt, sort).sort(sort)
  .limit(Number(req.query.limit) || 25).skip(Number(req.query.offset)).exec()
  .then(users => res.json({users, next: nextPageLink('/users', req.query)}))
  .catch(err => next(err));
});

api.route('/users/:id')
.get(auth.me, (req, res, next) => res.json(req.user.toJSON()), auth.next)
.get((req, res, next) => {
  User.findById(req.params.id).exec()
  .then(user => user || Promise.reject(404))
  .then(user => res.json(user))
  .catch(err => next(err));
})
.put(auth.me, (req, res, next) => {
  delete req.body.email;
  delete req.body.passwordhash;
  if (!Object.keys(req.body).length) {
    return next(400);
  }
  Object.assign(req.user, req.body).save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
});

api.route('/users/:id/recover')
.post(auth.me, (req, res, next) => {
  auth.requestRecovery(req.user.id, req.user.email)
  .then(() => res.end())
  .catch(err => next(err));
});

api.route('/users/:id/codes')
.get(auth.me, (req, res, next) => res.json({codes: req.user.codes}))
.post(auth.me, (req, res, next) => {
  if (!req.body.code) {
    return next(400);
  }
  let added = req.user.codes.addToSet(req.body.code);
  if (!added.length) {
    return next(409);
  }
  req.user.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
});
api.route('/users/:id/codes/:code').delete(auth.me, (req, res, next) => {
  if (req.user.codes.indexOf(req.params.code) < 0) {
    return next(404);
  }
  req.user.codes.pull(req.params.code);
  req.user.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
});

api.route('/users/:id/token').get(auth.me, (req, res, next) => {
  res.json({token : auth.jwt(User.modelName, req.user._id, req.user.passwordhash)});
});

// -------------------------------------------------------------------------------------------------
//    P R O D U C T S   &   P U R C H A S E S
// -------------------------------------------------------------------------------------------------

api.route('/products')
.get((req, res, next) => {
  let opt, sort;
  if (req.query.search) {
    opt = {$text: {$search: req.query.search}};
    sort = {score: {$meta: "textScore"}};
  }
  Product.find(opt, sort).sort(sort)
  .limit(Number(req.query.limit) || 25).skip(Number(req.query.offset)).exec()
  .then(products => res.json({products, next: nextPageLink('/products', req.query)}))
  .catch(err => next(err));
});

api.route('/products/:id')
.get((req, res, next) => {
  Product.findById(req.params.id).exec()
  .then(product => product || Promise.reject(404))
  .then(product => res.json(product))
  .catch(err => next(err));
});

api.route('/purchases')
.get((req, res, next) => {
  let query = Purchase.find({user: req.user._id});
  ['product', 'store'].forEach(key => req.query[key] && query.where(key, req.query[key]));
  query.sort('-time')
  .limit(Number(req.query.limit) || 25).skip(Number(req.query.offset))
  .populate('store user product', 'name email category').exec()
  .then(purchases => res.json({purchases, next: nextPageLink('/purchases', req.query)}))
  .catch(err => next(err));
});

api.route('/purchases/count')
.get((req, res, next) => {
  let query = Purchase.count({user: req.user._id});
  ['product', 'store'].forEach(key => req.query[key] && query.where(key, req.query[key]));
  query.exec()
  .then(count => res.json({count}))
  .catch(err => next(err));
});

// -------------------------------------------------------------------------------------------------
//    S T O R E
// -------------------------------------------------------------------------------------------------

api.route('/stores')
.get((req, res, next) => {
  Store.find().access(req.user._id)
  .limit(Number(req.query.limit) || 25).skip(Number(req.query.offset)).exec()
  .then(stores => Promise.all(stores.map(store =>
    Purchase.summary(store.id, req.user._id).exec()
    .then(summaries => summaries.length ? summaries[0] : {})
    .then(summary => store.summary(req.user._id, summary)))))
  .then(stores => res.json({stores, next: nextPageLink('/stores', req.query)}))
  .catch(err => next(err));
})
.post((req, res, next) => {
  if (!req.body.name) {
    return next(400);
  }
  const name = req.body.name;
  new Store({name, accesses: [{user: req.user._id, level: 0, admin: true}]}).save()
  .then(store => res.status(201).end())
  .catch(err => next(err));
});

api.route('/stores/:id')
.get((req, res, next) => {
  Promise.all([
    Store.findById(req.params.id).access(req.user._id).exec()
    .then(store => store || Promise.reject(404)),
    Purchase.summary(req.params.id, req.user._id).exec()
    .then(summaries => summaries.length ? summaries[0] : {})
  ])
  .then(([store, summary]) => store.summary(req.user._id, summary))
  .then(store => res.json(store))
  .catch(err => next(err));
});

api.route('/stores/:id/products')
.get((req, res, next) => {
  Promise.all([
    Store.findById(req.params.id).populate('range.product').exec()
    .then(store => store || Promise.reject(404)),
    Purchase.productStats(req.params.id, req.user._id)
  ])
  .then(([store, product_stats]) => Promise.all([
    store,
    product_stats,
    store.access(req.user._id)
    .catch(() => Promise.reject(401))
  ]))
  .then(([store, product_stats, access]) => store.range
    .filter(item => item.available || access.admin)
    .map(item => Object.assign(item.product.toJSON(), {
      popularity: product_stats.total && (product_stats[item.product._id] || 0) / product_stats.total,
      price: item.price(access.level)
    }, access.admin ? {
      available: item.available,
      pricelevels: item.pricelevels
    } : {}))
    .sort((a, b) => b.popularity - a.popularity))
  .then(products => res.json({products}))
  .catch(err => next(err));
});

api.route('/stores/:id/purchases')
.post((req, res, next) => {
  if (!req.body.product) {
    return next(400);
  }
  Store.findById(req.params.id).exec()
  .then(store => store || Promise.reject(404))
  .then(store => Promise.all([
    store,
    store.access(req.user._id)
    .catch(() => Promise.reject(401)),
    store.range.find(item => item.product.equals(req.body.product))
  ]))
  .then(([store, access, item]) => Promise.all(access.admin ? [
    store,
    req.body.user ? store.access(req.body.user)
                    .catch(() => Promise.reject(401))
                  : access,
    item,
    (!isNaN(req.body.price) || item) ? req.body.price : Promise.reject(400),
    req.body.time
  ] : [
    store, access, (item && item.available) ? item : Promise.reject(400)
  ]))
  .then(([store, access, item, price, time]) =>
    new Purchase({
      store: store._id,
      user: access.user,
      [item ? 'product' : 'note']: req.body.product,
      price: isNaN(price) ? item.price(access.level) : price,
      time: time
    }).save()
    .then(purchase => Purchase.populate(purchase, {
      path: 'store user product', select: 'name email category'
    }))
    .then(purchase => purchase.toJSON())
    .then(purchase => {
      res.status(201).json(purchase);
      if (purchase.product && purchase.price > 0) {
        // trigger store events (used for socket.io)
        store_events.emit('purchase', purchase.store._id, purchase);
        // trigger store webhooks
        store.webhooks.filter(({action}) => action === 'purchase')
        .forEach(webhook => rp.post({
          uri: webhook.url,
          headers: webhook.headers,
          body: webhook.render(purchase),
          json: true
        })
        .catch(err => {
          console.log('webhook error', err);
        }));
      }
    }))
  .catch(err => next(err));
});

// -------------------------------------------------------------------------------------------------
//    S T O R E - A D M I N
// -------------------------------------------------------------------------------------------------

let store_admin_api = express.Router({mergeParams: true});
api.use('/stores/:id', auth.store_admin, store_admin_api);

store_admin_api.route('/')
.put((req, res, next) => {
  if (!Object.keys(req.body).length) {
    return next(400);
  }
  if (req.body.name) {
    req.store.name = req.body.name;
    delete req.body.name;
  }
  Object.assign(req.store.metadata, req.body);
  req.store.markModified('metadata');
  req.store.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
})

store_admin_api.route('/users')
.get((req, res, next) => {
  let accesses = req.store.accesses.reduce((e, access) => (e[access.user] = access.toJSON(), e), {});
  Purchase.summary(req.store._id).exec()
  .then(summaries => summaries.reduce((accesses, summary) => {
    let access = accesses[summary.user] = accesses[summary.user] || {}
    Object.assign(access, summary);
    return accesses;
  }, accesses))
  .then(entries => Object.keys(entries).map(id => entries[id]))
  .then(entries => User.populate(entries, 'user'))
  .then(entries => entries.filter(entry => !req.query.search ||
      entry.user.name.toLowerCase().indexOf(req.query.search) >= 0))
  .then(entries => entries.map(entry => Object.assign(entry.user.toJSON(), {
    debt: entry.total || 0,
    access: entry.level !== undefined ? {
      level: entry.level,
      admin: entry.admin
    } : undefined,
    purchases: entry.count !== undefined ? {
      count: entry.count,
      latest: new Date(entry.latest)
    } : undefined
  })))
  .then(users => res.json({users}))
  .catch(err => next(err));
});

store_admin_api.route('/accesses')
.get((req, res, next) => {
  User.populate(req.store.accesses, 'user')
  .then(accesses => accesses.map(access => Object.assign(access.user.toJSON(), {
    level: access.level,
    admin: access.admin
  })))
  .then(accesses => res.json({accesses}))
  .catch(err => next(err));
})
.post((req, res, next) => {
  User.findById(req.body.user)
  .then(user => user || Promise.reject(400))
  .then(user => req.store.access(user._id).then(() => Promise.reject(409), () => user))
  .then(user => {
    let end = req.store.accesses.length;
    req.store.accesses.push(req.body);
    let access = req.store.accesses[end];
    return req.store.save().then(() => (access.user = user, access));
  })
  .then(access => Object.assign(access.user.toJSON(), {
    level: access.level,
    admin: access.admin
  }))
  .then(access => res.status(201).json(access))
  .catch(err => next(err));
});

store_admin_api.route('/accesses/:id')
.get((req, res, next) => {
  let access = req.store.accesses.find(access => access.user.equals(req.params.id));
  if (!access) {
    return next(404);
  }
  User.populate(access, 'user')
  .then(access => Object.assign(access.user.toJSON(), {
    level: access.level,
    admin: access.admin
  }))
  .then(access => res.json(access))
  .catch(err => next(err));
})
.put((req, res, next) => {
  let access = req.store.accesses.find(access => access.user.equals(req.params.id));
  if (!access) {
    return next(404);
  }
  if (!Object.keys(req.body).length) {
    return next(400);
  }
  Object.assign(access, req.body);
  req.store.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
})
.delete((req, res, next) => {
  let access = req.store.accesses.find(access => access.user.equals(req.params.id));
  if (!access) {
    return next(404);
  }
  req.store.accesses.pull(access);
  let admin_accesses = req.store.accesses.filter(access => access.admin);
  if (admin_accesses.length == 0) {
    return next(412);
  }
  req.store.save()
  .then(() => User.populate(access, 'user'))
  .then(access => Object.assign(access.user.toJSON(), {
    level: access.level,
    admin: access.admin
  }))
  .then(access => res.json(access))
  .catch(err => next(err));
});

store_admin_api.route('/products')
.post((req, res, next) => {
  Promise.resolve(
    req.body.product ? Product.findById(req.body.product).exec()
    .then(product => product || Promise.reject(400))
    .then(product => req.store.range.find(item => item.product.equals(product._id)) ? Promise.reject(409) : product) :
    req.body.name ? new Product({name: req.body.name, category: req.body.category}) : Promise.reject(400))
  .then(product => {
    let pricelevels = req.body.pricelevels;
    let available = req.body.available;
    let end = req.store.range.length;
    req.store.range.push({product: product._id, pricelevels});
    let item = req.store.range[end];
    return req.store.save()
    .then(() => product.save())
    .then(product => (item.product = product, item))
  })
  .then(item => Object.assign(item.product.toJSON(), {
    pricelevels: item.pricelevels,
    available: item.available
  }))
  .then(product => res.status(201).json(product))
  .catch(err => next(err));
});

store_admin_api.route('/products/:product_id')
.get((req, res, next) => {
  let item = req.store.range.find(item => item.product.equals(req.params.product_id));
  if (!item) {
    return next(404);
  }
  Product.populate(item, 'product')
  .then(item => Object.assign(item.product.toJSON(), {
    pricelevels: item.pricelevels,
    available: item.available
  }))
  .then(product => res.json(product))
  .catch(err => next(err));
})
.put((req, res, next) => {
  let item = req.store.range.find(item => item.product.equals(req.params.product_id));
  if (!item) {
    return next(404);
  }
  if (!Object.keys(req.body).length) {
    return next(400);
  }
  Object.assign(item, req.body);
  req.store.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
})
.delete((req, res, next) => {
  let item = req.store.range.find(item => item.product.equals(req.params.product_id));
  if (!item) {
    return next(404);
  }
  req.store.range.pull(item);
  req.store.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
});

store_admin_api.route('/purchases')
.get((req, res, next) => {
  let query = Purchase.find({store: req.store._id});
  ['product', 'user'].forEach(key => req.query[key] && query.where(key, req.query[key]));
  query.sort('-time')
  .limit(Number(req.query.limit) || 25).skip(Number(req.query.offset))
  .populate('store user product', 'name email category').exec()
  .then(purchases => res.json({
    purchases,
    next: nextPageLink(`/stores/${req.store._id}/purchases`, req.query)
  }))
  .catch(err => next(err));
});

store_admin_api.route('/purchases/:purchase_id')
.delete((req, res, next) => {
  Purchase.findByIdAndRemove(req.params.purchase_id).exec()
  .then(purchase => purchase || Promise.reject(404))
  .then(purchase => res.status(204).end())
  .catch(err => next(err));
});

store_admin_api.route('/purchases/count')
.get((req, res, next) => {
  let query = Purchase.count({store: req.store._id});
  ['product', 'user'].forEach(key => req.query[key] && query.where(key, req.query[key]));
  query.exec()
  .then(count => res.json({count}))
  .catch(() => next(1));
});

store_admin_api.route('/webhooks')
.get((req, res, next) => {
  res.json({webhooks: req.store.webhooks});
})
.post((req, res, next) => {
  let end = req.store.webhooks.length;
  req.store.webhooks.push(req.body);
  let webhook = req.store.webhooks[end];
  req.store.save()
  .then(() => res.status(201).json(webhook))
  .catch(err => next(err));
});

store_admin_api.route('/webhooks/:id')
.delete((req, res, next) => {
  let webhook = req.store.webhooks.find(webhook => webhook._id.equals(req.params.id));
  if (!webhook) {
    return next(404);
  }
  req.store.webhooks.pull(webhook);
  req.store.save()
  .then(() => res.status(204).end())
  .catch(err => next(err));
});

// todo: verify this works
store_admin_api.route('/backup')
.get((req, res, next) => res.set({
  'Content-Disposition': `attachment; filename="${req.store.name}.json"`,
  'Content-Type': 'application/json'
}).send(JSON.stringify(req.store)));

// todo: verify this works
store_admin_api.route('/purchases/backup')
.get((req, res, next) => {
  res.set({
    'Content-Disposition': `attachment; filename="purchases.json"`,
    'Content-Type': 'application/json'
  });
  let query = Purchase.find({store: req.store._id});
  req.body.user && query.where('user', req.body.user);
  req.body.min && query.gte('time', req.body.min);
  query.sort('-time').select('-__v -store')
  .populate({path: 'user product', select: 'name email category'})
  .stream({transform: JSON.stringify})
  .pipe(res);
});

store_admin_api.route('/token')
.get((req, res, next) => {
  res.json({token: auth.jwt(Store.modelName, req.store._id)});
});

store_admin_api.route('/terminal')
.get((req, res, next) => {
  req.user = req.store;
  next();
}, auth.login, (req, res) => res.redirect('/'));

api.use(auth.catch);

module.exports = api;
