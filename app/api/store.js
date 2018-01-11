const config = require('config');
const express = require('express');
const rp = require('request-promise');
const auth = require('../auth');
const store_events = require('../events');

const User = require('../models/user');
const Store = require('../models/store');
const Product = require('../models/product');
const Purchase = require('../models/purchase');

const api = express.Router();

api.use((req, res, next) => {
  req.store = req.user;
  delete req.user;
  next();
});

function nextPageLink(path, query) {
  const limit = parseInt(query.limit || 25);
  const next_offset = parseInt(query.offset || 0) + limit;
  return `${config.server}/api/v1${path}?limit=${limit}&offset=${next_offset}`;
}

api.route('/stores/:id')
.get(auth.this, (req, res, next) => res.json(req.store.toJSON()));

api.route('/codes/:code')
.get((req, res, next) => {
  Promise.all([
    User.findOne().where('codes', req.params.code).exec(),
    Product.findOne().where('barcodes', req.params.code).exec()
  ])
  .then(([user, product]) =>
    user && req.store.access(user._id)
    .then(access => Object.assign(user.toJSON(), {
      level: access.level,
      admin: access.admin
    }))
    .then(user => res.json({type: 'user', user})) ||
    product && req.store.item(product._id)
    .then(item => item.available || Promise.reject(404))
    .then(item => Object.assign(product.toJSON(), {
      pricelevels: item.pricelevels
    }))
    .then(product => res.json({type: 'product', product})) ||
    Promise.reject(404))
  .catch(err => next(err));
});

api.route('/users/:id/codes')
.post((req, res, next) => {
  if (!req.body.code) {
    return next(400);
  }
  User.findById(req.params.id).exec()
  .then(user => {
    const added = user.codes.addToSet(req.body.code).length > 0;
    if (!added) {
      return next(409);
    }
    return user.save()
  })
  .then(() => res.status(204).end())
  .catch(err => next(err));
});

api.route('/products')
.get((req, res, next) => {
  Promise.all([
    Product.populate(req.store, 'range.product'),
    req.query.user && Purchase.productStats(req.store._id, req.query.user)
  ])
  .then(([store, product_stats]) => store.range
    .filter(item => item.available)
    .map(item => Object.assign(item.product.toJSON(), product_stats ? {
      popularity: product_stats.total && (product_stats[item.product._id] || 0) / product_stats.total,
    } : {}, {
      pricelevels: item.pricelevels
    }))
    .sort((a, b) => b.popularity - a.popularity))
  .then(products => products.splice(req.query.offset || 0, req.query.limit || Infinity))
  .then(products => res.json({products, next: nextPageLink('/products', req.query)}))
  .catch(err => next(err));
});

api.route('/purchases')
.get((req, res, next) => {
  let query = Purchase.find({store: req.store._id});
  ['product', 'user'].forEach(key => req.query[key] && query.where(key, req.query[key]));
  query.sort('-time')
  .limit(Number(req.query.limit) || 25).skip(Number(req.query.offset))
  .populate('store user product', 'name email category').exec()
  .then(purchases => res.json({purchases, next: nextPageLink('/purchases', req.query)}))
  .catch(err => next(err));
})
.post((req, res, next) => {
  if (!req.body.product || !req.body.user) {
    return next(400);
  }
  Promise.all([
    req.store.access(req.body.user),
    req.store.item(req.body.product)
  ])
  .catch(() => Promise.reject(400))
  .then(([access, item]) =>
    new Purchase({
      store: req.store._id,
      user: access.user,
      product: item.product,
      amount: req.body.amount || 1,
      price: item.price(access.level)
    }).save()
    .then(purchase => Purchase.populate(purchase, {
      path: 'store user product', select: 'name email category'
    }))
    .then(purchase => purchase.toJSON())
    .then(purchase => {
      res.status(201).json(purchase);
      // trigger store events (used for socket.io)
      store_events.emit('purchase', req.store._id, purchase);
      // trigger store webhooks
      req.store.webhooks.filter(({action}) => action === 'purchase')
      .forEach(webhook => rp.post({
        uri: webhook.url,
        headers: webhook.headers,
        body: webhook.render(purchase),
        json: true
      })
      .catch(err => {
        console.log('webhook error', err);
      }));
    }))
  .catch(err => next(err));
});

api.route('/purchases/count')
.get((req, res, next) => {
  let query = Purchase.count({store: req.store._id});
  ['product', 'user'].forEach(key => req.query[key] && query.where(key, req.query[key]));
  query.exec()
  .then(count => res.json({count}))
  .catch(err => next(err));
});

api.use((req, res, next) => {
  req.user = req.store;
  delete req.store;
  next();
});

api.use(auth.catch);

module.exports = api;
