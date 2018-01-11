const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const PurchaseSchema = new mongoose.Schema({
  store: {type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true},
  user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
  product: {type: mongoose.Schema.Types.ObjectId, ref: 'Product'},
  note: {type: String},
  amount: {type: Number, required: true, min: 1},
  price: {type: Number, required: true},
  time: {type: Date, required: true, default: Date.now}
});
PurchaseSchema.index({store: 1, product: 1, user: 1, time: 1}, {unique: true, sparse: true});

PurchaseSchema.statics.summary = function(store, user) {
  return Purchase.aggregate([
    {$match: Object.assign(store && {store: ObjectId(store)}, user && {user: ObjectId(user)})}, {
      $group: {
        _id: '$user',
        store: {$first: '$store'},
        user: {$first: '$user'},
        count: {$sum: 1},
        amount: {$sum: '$amount'},
        total: {$sum: {$multiply: ['$price', '$amount']}},
        latest: {$last: '$time'},
      }
    },
    {$project: {_id: 0, store: 1, user: 1, count: 1, amount: 1, total: 1, latest: 1}}
  ]);
};
PurchaseSchema.statics.productStats = function(store, user) {
  return Purchase
      .aggregate([
        {$match: Object.assign(store && {store: ObjectId(store)}, user && {user: ObjectId(user)})},
        {
          $group: {
            _id: '$product',
            product: {$first: '$product'},
            amount: {$sum: '$amount'},
            price: {$sum: {$multiply: ['$price', '$amount']}}
          }
        },
        {$project: {_id: 1, product: 1, amount: 1, price: 1}}, {$sort: {amount: -1}}
      ])
      .exec()
      .then(purchases => purchases.reduce((data, purchase) => {
        data.total += (data[purchase.product] = purchase.amount);
        return data;
      }, {total: 0}))
};

PurchaseSchema.set('toJSON', {versionKey: false});

Purchase = mongoose.model('Purchase', PurchaseSchema);
module.exports = Purchase;
