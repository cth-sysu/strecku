const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema(
    {
      product: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
      label: {type: String},
      // todo: vask
      pricelevels: {type: [Number], required: true, default: [0]},
      // price: {type: Number, required: true},
      // discount: {type: Number, default: 0},
      available: {type: Boolean, default: true}
    },
    {_id: false});

ItemSchema.methods.price = function(level) {
  return this.pricelevels[Math.min(level, this.pricelevels.length - 1)];
};

const AccessSchema = new mongoose.Schema(
    {
      user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
      // todo: vask
      level: {type: Number, required: true, min: 0},
      // discount: {type: Boolean, default: false},
      admin: {type: Boolean, required: true, default: false},
      issued: {type: Date, default: Date.now, select: false}
    },
    {_id: false});

const WebhookSchema = new mongoose.Schema({
  action: {type: String, required: true},
  name: {type: String, required: true},
  url: {type: String, required: true},
  template: {}
});

WebhookSchema.methods.render = function(data) {
  const _render = (obj, key) => {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(
          /{{(.*?)}}/g,
          (_, path) => path.split('.').reduce(
              (sub, key) =>
                  sub && (sub[key] instanceof Date ? Date.parse(sub[key]) / 1000 : sub[key]),
              data));
    } else if (typeof obj[key] === 'object') {
      obj[key] = Object.keys(obj[key]).reduce(_render, obj[key]);
      }
    return obj;
  };
  if (this.template) {
    return _render([this.template], 0)[0];
    }
  return data;
};

const StoreSchema = new mongoose.Schema(
    {
      name: {type: String, required: true},
      metadata: {type: {}, required: true, default: {}},
      range: {type: [ItemSchema], default: []},
      accesses: {type: [AccessSchema], default: []},
      webhooks: {type: [WebhookSchema], default: []}
    },
    {minimize: false});

StoreSchema.methods.item = function(product) {
  const item = this.range.find(item => item.product.equals(product));
  return item ? Promise.resolve(item) : Promise.reject(404);
};
StoreSchema.methods.access = function(user) {
  const access = this.accesses.find(access => access.user.equals(user));
  return access ? Promise.resolve(access) : Promise.reject(404);
};
StoreSchema.methods.admin = function(user) {
  const access = this.accesses.find(access => access.user.equals(user));
  return access && access.admin ? Promise.resolve(access) : Promise.reject(404);
};
StoreSchema.methods.summary = function(user, summary) {
  return Object.assign(this.toJSON(), {
    debt: summary.total || 0,
    purchases: {
      count: summary.count || 0,
      products: summary.amount || 0,
      latest: new Date(summary.latest || 0)
    },
    admin: this.accesses.find(access => access.user.equals(user)).admin
  });
};

StoreSchema.set('toJSON', {
  versionKey: false,
  transform: (doc, ret) => {
    delete ret.range;
    delete ret.accesses;
  }
});

const Store = mongoose.model('Store', StoreSchema);

mongoose.Query.prototype.access = function(user) {
  return this.mongooseCollection !== Store.collection ? this : this.elemMatch('accesses', {user});
};
mongoose.Query.prototype.admin = function(user) {
  return this.mongooseCollection !==
          Store.collection ? this :
                            this.elemMatch('accesses', {user, admin: true});
};

module.exports = Store;
