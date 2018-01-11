require('../shared/filters');
require('../shared/purchaseslist');

angular.module('strecku.admin', [
  'strecku.datefilter',
  'strecku.volumefilter',
  'strecku.purchases',
  'ngMaterial',
  'ngMessages',
  'ngRoute',
  'ngCookies',
  'ngAnimate',
  'ngSanitize'])
.config(['$routeProvider', '$locationProvider', ($routeProvider, $locationProvider) => {
  $routeProvider
  .when('/admin/:store_id', {
    redirectTo: ($routeParams, current) => `${current}/general?menu=true`
  })
  .when('/admin/:store_id/general', {
    templateUrl: 'admin/views/general.html',
    controller: 'GeneralCtrl'
  })
  .when('/admin/:store_id/accesses', {
    templateUrl: 'admin/views/accesses.html',
    controller: 'AccessesCtrl'
  })
  .when('/admin/:store_id/accesses2', {
    templateUrl: 'admin/views/accesses-old.html',
    controller: 'AccessesCtrl'
  })
  .when('/admin/:store_id/products', {
    templateUrl: 'admin/views/products.html',
    controller: 'ProductsCtrl'
  })
  .when('/admin/:store_id/products2', {
    templateUrl: 'admin/views/products-old.html',
    controller: 'ProductsCtrl'
  })
  .when('/admin/:store_id/purchases', {
    templateUrl: 'admin/views/purchases.html',
    controller: 'PurchasesCtrl'
  })
  .when('/admin/:store_id/webhooks', {
    templateUrl: 'admin/views/webhooks.html',
    controller: 'WebhooksCtrl'
  })
  .when('/admin/:store_id/invite', {
    templateUrl: 'admin/views/invite.html',
    controller: 'InviteCtrl'
  })
  .when('/admin/:store_id/api', {
    templateUrl: 'admin/views/api.html',
    controller: 'ApiCtrl'
  });
  $locationProvider.html5Mode(true);
}])
.config(['$mdThemingProvider', $mdThemingProvider => {
  $mdThemingProvider.theme('default').primaryPalette('blue-grey').accentPalette('grey');
}])
.run(['$window', '$mdMedia', '$rootScope', '$location', '$http', function($window, $mdMedia, $rootScope, $location, $http){
  $rootScope.back = function(menu){
    if (menu || $mdMedia('gt-xs')){
      return $window.location.href = '/';
    }
    $rootScope.menu.show = true;
  };
  $rootScope.menu = {show: false};
  $rootScope.$on('$routeChangeSuccess', () => $rootScope.menu.show = !!$location.search().menu);
  var store_id = $location.path().match(/^\/admin\/([^\/]*)/)[1];
  $http.get(`/api/v1/stores/${store_id}`)
  .then(res => $rootScope.store = res.data);
}])
.service('AddAction', function() {
  this.active = false;
  this.config = function(label, action){
    this.active = !!label;
    this.label = `Add ${label}`;
    this.action = action;
  }
})
.directive('productImage', () => (scope, element, attrs) => {
  const update = (id, v) => element.attr('src', `/api/v1/products/${id}/images/0?${v}`);
  scope.$watch(attrs.productImage, id => {
    let v = 0;
    update(id, v);
    scope.$on(`${id}/images`, () => update(id, ++v));
  });
})
.controller('AddActionCtrl', ['$scope', 'AddAction', function($scope, AddAction) {
  $scope.add = AddAction;
}])
.filter('admin', () => (accesses) => accesses.filter(access => access.admin))
.filter('valid', () => (members, issued, valid) => members.filter(
  member => (new Date(member.since) <= new Date(issued)) ==
            (valid == undefined ? true : valid)))
.controller('MenuCtrl', [ '$scope', '$route', function($scope, $route) {
  $scope.active = category => $route.current && $route.current.controller == `${category}Ctrl`;
}])
.controller('GeneralCtrl', ['$routeParams', '$scope', '$http', 'AddAction', '$window', '$mdColorPalette', function($routeParams, $scope, $http, AddAction, $window, $mdColorPalette) {
  AddAction.config(false);
  // edit details
  $scope.colors = Object.keys($mdColorPalette);
  $scope.save = (name, color) =>
    $http.put(`/api/v1/stores/${$routeParams.store_id}`, {name, color})
    .then(res => $scope.store.name = name);
  // get users
  $http.get(`/api/v1/stores/${$routeParams.store_id}/users`)
  .then(res => {
    $scope.users = res.data.users;
    $scope.total = $scope.users.reduce((total, user) => total + (user.debt || 0), 0);
  });
  $scope.debt_filter = user => user.debt;
  $scope.date = Date.now();
  $scope.print = () => $window.print();
  $scope.storeBackupLink = `/api/v1/stores/${$routeParams.store_id}/backup?type=store&pretty=true`;
  $scope.purchasesBackupLink = `/api/v1/stores/${$routeParams.store_id}/purchases/backup?type=purchases&pretty=true`;
}])
.controller('AccessesCtrl', [ '$routeParams', '$scope', '$http', 'AddAction', '$mdToast', '$mdDialog', '$window', function($routeParams, $scope, $http, AddAction, $mdToast, $mdDialog, $window) {
  AddAction.config('access', (ev) =>
    $mdDialog.show({
      controller: 'AccessesAddCtrl',
      templateUrl: 'admin/views/accesses/add_access.html',
      targetEvent: ev,
      clickOutsideToClose: true,
      locals: $routeParams
    })
    .then(access => $scope.accesses.push(access)));
  var url = `/api/v1/stores/${$routeParams.store_id}/accesses`;
  $http.get(url)
  .then(res => $scope.accesses = res.data.accesses);
  // $scope.increaseLevel = user => setLevel(user, user.level + 1);
  // $scope.decreaseLevel = user => setLevel(user, user.level - 1);
  $scope.toggleDiscount = user => setLevel(user, user.level ? 0 : 1);
  function setLevel(user, level) {
    $http.put(`${url}/${user._id}`, {level})
    .then(res => user.level = level);
  }
  // $scope.renew = function(access, date) {
  //     var level = access.level;
  //     var previous = access.issued;
  //     var issued = date || Date.now();
  //     $http.put(`${url}/${access._id}`, { level, issued })
  //     .then(function(res) {
  //         access.issued = issued;
  //         // Toast with undo
  //         $mdToast.show($mdToast.simple()
  //         .textContent('Access updated')
  //         .action('UNDO')
  //         .highlightAction(true))
  //         .then(function(res) {
  //             if (res == 'ok') {
  //                 $http.put(`${url}/${access._id}`, { level, issued: previous })
  //                 .then(function(res) { access.issued = previous; });
  //             }
  //         });
  //     });
  // };
  $scope.toggleAdmin = user => {
    $http.put(`${url}/${user._id}`, {admin: !user.admin})
    .then(res => user.admin = !user.admin);
  };
  // $scope.revokeAdmin = function(access, $event) {
  //     $mdDialog.show($mdDialog.confirm()
  //     .title('Revoke admin')
  //     .textContent('If you revoke the admin role you will be logged out. Do you wish to continue?')
  //     .ok('Revoke').cancel('Cancel')
  //     .targetEvent($event)
  //     ).then(function(){
  //         $http.delete(`${url}/${access._id}/admin`)
  //         .then(function(res) {
  //             $window.location.replace('/');
  //         });                
  //     });
  // };
  $scope.remove = user => {
    $http.delete(`${url}/${user._id}`)
    .then(res => $scope.accesses.splice($scope.accesses.indexOf(user), 1));
  };
}])
.controller('AccessesAddCtrl', ['$scope', '$http', '$q', '$mdDialog', 'store_id', function($scope, $http, $q, $mdDialog, store_id) {
  $scope.$on('$routeChangeStart', $scope.cancel = $mdDialog.cancel);
  $scope.queryUsers = search =>
    $http.get(`/api/v1/users?limit=4&search=${search}`)
    .then(res => res.data.users);
  $scope.add = user =>
    $http.post(`/api/v1/stores/${store_id}/accesses`, {user: user._id, level: 1})
    .then(res => $mdDialog.hide(res.data))
    .catch(err => $scope.accessForm.user.$setValidity('duplicate', false));
}])
.controller('ProductsCtrl', ['$routeParams', '$scope', '$http', 'AddAction', '$mdDialog', function($routeParams, $scope, $http, AddAction, $mdDialog) {
  AddAction.config('product', (ev) =>
    $mdDialog.show({
      controller: 'ProductsAddCtrl',
      templateUrl: 'admin/views/products/add_product.html',
      targetEvent: ev,
      clickOutsideToClose: true,
      locals: $routeParams
    })
    .then(product => $scope.products.push(product)));
  var url = `/api/v1/stores/${$routeParams.store_id}/products`;
  $http.get(url)
  .then(res => $scope.products = res.data.products);
  $scope.setAvailability = (product, available) =>
    $http.put(`${url}/${product._id}`, {available})
    .then(res => product.available = available);
  $scope.edit = (product, ev) =>
    $mdDialog.show({
      controller: 'ProductsEditCtrl',
      templateUrl: 'admin/views/products/edit_product.html',
      targetEvent: ev,
      clickOutsideToClose: true,
      locals: {product, store_id: $routeParams.store_id}
    })
    .then(pricelevels => product.pricelevels = pricelevels);
  $scope.remove = product =>
    $http.delete(`${url}/${product._id}`)
    .then(res => $scope.products.splice($scope.products.indexOf(product), 1));
}])
.controller('ProductsAddCtrl', ['$scope', '$http', '$mdConstant', '$mdDialog', 'store_id', '$filter', '$timeout', function($scope, $http, $mdConstant, $mdDialog, store_id, $filter, $timeout) {
  $scope.$on('$routeChangeStart', $scope.cancel = $mdDialog.cancel);
  $scope.queryProducts = query =>
    $http.get(`/api/v1/products?limit=50&search=${query}`)
    .then(res => res.data.products);
  $scope.productText = product => product.name + (product.metadata.systembolaget
        ? ` ${$filter('volume')(product.metadata.systembolaget.Volymiml)} ${product.metadata.systembolaget.Forpackning} (${$filter('currency')(product.metadata.systembolaget.Prisinklmoms + (product.metadata.systembolaget.Pant || 0), 'kr')})`
        : '');
  $scope.addExisting = (product, price, discount) => {
    let pricelevels = [price * (1 - (discount || 0) / 100), price];
    $http.post(`/api/v1/stores/${store_id}/products`, {product, pricelevels})
    .then(res => $mdDialog.hide(res.data))
    .catch(err => $scope.productForm.product.$setValidity('duplicate', false));
  };
  $scope.addNew = (name, price, discount) => {
    let pricelevels = [price * (1 - (discount || 0) / 100), price];
    $http.post(`/api/v1/stores/${store_id}/products`, {name, pricelevels})
    .then(res => $mdDialog.hide(res.data))
    .catch(err => $scope.productForm.product.$setValidity('duplicate', false));
  };
}])
.controller('ProductsEditCtrl', ['$scope', '$http', '$mdConstant', '$mdDialog', 'store_id', 'product', function($scope, $http, $mdConstant, $mdDialog, store_id, product) {
  $scope.$on('$routeChangeStart', $scope.cancel = $mdDialog.cancel);
  $scope.product = product;
  $scope.price = product.pricelevels.length == 1 ? product.pricelevels[0]
                                                 : product.pricelevels[1];
  $scope.discount = product.pricelevels.length > 1 ? Math.round(100 * (1 - (product.pricelevels[0] / product.pricelevels[1])))
                                                   : undefined;
  $scope.save = (price, discount) => {
    let pricelevels = [price * (1 - (discount || 0) / 100), price];
    $http.put(`/api/v1/stores/${store_id}/products/${product._id}`, {pricelevels})
    .then(res => $mdDialog.hide(pricelevels));
  };
}])
.controller('PurchasesCtrl', ['$routeParams', '$scope', '$http', 'AddAction', 'PurchasesList', '$mdDialog', function($routeParams, $scope, $http, AddAction, PurchasesList, $mdDialog) {
  AddAction.config('purchase', (ev) =>
    $mdDialog.show({
      controller: 'PurchasesAddCtrl',
      templateUrl: 'admin/views/purchases/add_purchase.html',
      targetEvent: ev,
      clickOutsideToClose: true,
      locals: $routeParams
    })
    .then(() => $scope.items.reload()));
  $scope.items = new PurchasesList($routeParams.store_id);
  $scope.delete = purchase =>
    $http.delete(`/api/v1/stores/${$routeParams.store_id}/purchases/${purchase._id}`)
    .then(() => $scope.items.reload());
  $scope.queryUsers = search =>
    $http.get(`/api/v1/users?search=${search}`)
    .then(res => res.data.users);
}])
.controller('PurchasesAddCtrl', ['$scope', '$http', '$mdDialog', 'store_id', function($scope, $http, $mdDialog, store_id){
  $scope.$on('$routeChangeStart', $scope.cancel = $mdDialog.cancel);
  $scope.purchase = {};
  $scope.time = {date: new Date(), time: new Date(0)};
  $scope.queryUsers = search =>
    $http.get(`/api/v1/stores/${store_id}/users?search=${search}`)
    .then(res => res.data.users);
  $scope.queryProducts = search =>
    $http.get(`/api/v1/stores/${store_id}/products?search=${search}`)
    .then(res => res.data.products);
  $scope.userChanged = user => updatePrice(user, $scope.product);
  $scope.productChanged = product => updatePrice($scope.user, product);
  function updatePrice(user, product) {
    if (product && user && user.access !== undefined) {
      $scope.purchase.price = Math.round(product.pricelevels[Math.min(product.pricelevels.length - 1, user.access.level)]);
    }
  }
  $scope.add = (purchase, user, product, time) => {
    Object.assign(purchase, {user, product});
    if (time) {
      purchase.time = new Date(time.date);
      purchase.time.setHours(time.time.getHours(), time.time.getMinutes());
    }
    $http.post(`/api/v1/stores/${store_id}/purchases`, purchase)
    .then(res => $mdDialog.hide(res.data));
  };
}])
.controller('WebhooksCtrl', ['$routeParams', '$scope', '$http', 'AddAction', '$mdDialog', function($routeParams, $scope, $http, AddAction, $mdDialog) {
  AddAction.config('webhook', (ev) =>
    $mdDialog.show({
      controller: 'WebhooksAddCtrl',
      templateUrl: 'admin/views/webhooks/add_webhook.html',
      targetEvent: ev,
      clickOutsideToClose: true,
      locals: $routeParams
    })
    .then(webhook => $scope.webhooks.push(webhook)));
  $http.get(`/api/v1/stores/${$routeParams.store_id}/webhooks`)
  .then(res => $scope.webhooks = res.data.webhooks);
  $scope.remove = webhook =>
    $http.delete(`/api/v1/stores/${$routeParams.store_id}/webhooks/${webhook._id}`)
    .then(res => $scope.webhooks.splice($scope.webhooks.indexOf(webhook), 1));
}])
.controller('WebhooksAddCtrl', ['$scope', '$http', '$mdDialog', 'store_id', function($scope, $http, $mdDialog, store_id){
  $scope.$on('$routeChangeStart', $scope.cancel = $mdDialog.cancel);
  $scope.add = (name, action, url, template) => {
    let webhook = {name, action, url, template};
    $http.post(`/api/v1/stores/${store_id}/webhooks`, webhook)
    .then(res => $mdDialog.hide(res.data));
  };
  $http.get(`/api/v1/stores/${store_id}/purchases?limit=1`)
  .then(res => {
    $scope.example = res.data.purchases[0]});
}])
.controller('InviteCtrl', ['$routeParams', '$scope', '$http', '$mdToast', '$location', function($routeParams, $scope, $http, $mdToast, $location) {
  $scope.sendInvite = email =>
    $http.post(`/api/v1/tokens`, {email})
    .then(() => {
      $mdToast.show($mdToast.simple()
        .textContent('Invite send')
        .action('add access')
        .highlightAction(true)
        .highlightClass('md-primary'))
      .then(() => $location.path(`/admin/${$routeParams.store_id}/accesses`));
    });
}])
.controller('ApiCtrl', ['$routeParams', '$scope', '$http', '$sanitize', function($routeParams, $scope, $http, $sanitize, Toolbar) {
  $http.get(`/api/v1/stores/${$routeParams.store_id}/token`)
  .then(res => $scope.token = res.data.token);
  $scope.copy = id => {
    document.getElementById(id).select();
    document.execCommand('copy');
  }
  $http.get('/api/store.md')
  .then(res => $http.post('https://api.github.com/markdown', {text: res.data}))
  .then(res => $scope.docs = $sanitize(res.data));
}]);
