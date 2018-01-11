const config = require('config');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const request = require('request');
const JSONStream = require('JSONStream');
const auth = require('../auth');

const Image = require('../models/image');
const Product = require('../models/product');

const api = express.Router();
const upload = multer({dest: '/tmp/'});

api.route('/products/:id/images/:image_id')
.get((req, res, next) => {
  Product.findById(req.params.id).exec()
  .then(product => product || Promise.reject(404))
  .then(product => {
    if (product.image) {
      return res.redirect(`/api/v1/images/${product.image}`);
    }
    const words = product.name.split(' ');
    let name = '', i = 0;
    while (name.length < 6 && i < words.length) {
      name += words[i++];
    }
    const tag = encodeURIComponent(name.replace(/[^0-9a-zåäöA-ZÅÄÖ_]/g, ''));
    const instagram = `https://api.instagram.com/v1/tags/${tag}/media/recent?count=1&access_token=${config.instagram && config.instagram.token}`;
    request(instagram)
        .pipe(JSONStream.parse('data.*', data => data.images.low_resolution.url))
        .on('data', url => res.redirect(url))
        .on('end', () => res.headersSent || res.end());
  });
})
.post(upload.single('image'), (req, res, next) => {
  Product.findById(req.params.id).exec()
  .then(product => product || Promise.reject(404))
  .then(product => {
    return new Promise((resolve, reject) => {
      fs.readFile(req.file.path, (err, data) => {
        if (err) {
          return reject(err.message);
        }
        const contentType = req.file.mimetype;
        const log = {email: req.user.email};
        const image = new Image({data, contentType, updatedAt: [log]});
        product.image = image._id;
        resolve(Promise.all([product.save(), image.save()]));
      })
    })
  })
  .then(() => res.status(204).end())
  .catch(err => next(err));
});

api.route('/images/:id')
.get((req, res, next) => {
  Image.findById(req.params.id).exec()
  .then(image => image || Promise.reject(404))
  .then(image => {
    res.contentType(image.contentType);
    res.send(image.data);
  })
});

api.use(auth.catch);

module.exports = api;
