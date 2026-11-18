const express = require('express');
const fs = require('fs');
const multer = require('multer');
const auth = require('../auth');

const Image = require('../models/image');
const Product = require('../models/product');

const api = express.Router();
const upload = multer({dest: '/tmp/'});

api.route('/products/:id/images/:image_id')
.get((req, res, next) => {
  return Product.findById(req.params.id).exec()
  .then(product => product || Promise.reject(404))
  .then(product => {
    if (product.image) {
      return res.redirect(`/api/v1/images/${product.image}`);
    }
    return res.status(204).end();
  })
  .catch(next);
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
