const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
    {
      name: {type: String, required: true, text: true},
      category: {type: String},
      barcodes: {type: [Number], default: []},
      image: {type: mongoose.Schema.Types.ObjectId, ref: 'Image'},
      metadata: {systembolaget: {}}
    },
    {minimize: false});

ProductSchema.set('toJSON', {versionKey: false});

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;
