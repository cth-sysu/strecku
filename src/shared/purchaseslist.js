angular.module('strecku.purchases', [])
.service('PurchasesList', ['$http', '$timeout', function($http, $timeout) {
  var PurchasesList = function(store) {
    this.items = {};
    this.length = -1;
    this.url = store ? `/api/v1/stores/${store}/purchases` : '/api/v1/purchases';
    this.reload();
  };
  PurchasesList.prototype._fetchPage = function(pageNumber) {
    this.items[pageNumber] = null;
    $http.get(`${this.url}?limit=50&offset=${pageNumber * 50}` + (this.user ? `&user=${this.user._id}` : ''))
    .then(res => this.items[pageNumber] = res.data.purchases);
  };
  // Public
  PurchasesList.prototype.initialized = false;
  PurchasesList.prototype.reload = function() {
    this.items = [];
    $http.get(`${this.url}/count` + (this.user ? `?user=${this.user._id}` : ''))
    .then(res => this.length = res.data.count);
  };
  PurchasesList.prototype.filterUser = function(user) {
    this.user = user;
    this.reload();
  };
  // Autocomplete items interface
  PurchasesList.prototype.getItemAtIndex = function(index) {
    const page_number = Math.floor(index / 50);
    const page = this.items[page_number];
    if (page) {
      return page[index % 50];
    } else if (page !== null) {
      this._fetchPage(page_number);
    }
  };
  PurchasesList.prototype.getLength = function() {
    return this.length;
  };
  return PurchasesList;
}]);