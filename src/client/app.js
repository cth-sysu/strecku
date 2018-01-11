require('../shared/filters');
require('../shared/purchaseslist');

angular.module('strecku.client', [
  'strecku.datefilter',
  'strecku.purchases',
  'ngMaterial',
  'ngMessages',
  'ngRoute',
  'ngCookies',
  'ngAnimate',
  'ngSanitize'])
.config(['$compileProvider', $compileProvider => {
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|swish):/);
}])
.config(['$routeProvider', '$locationProvider', ($routeProvider, $locationProvider) => {
  $routeProvider
  .when('/', {
    templateUrl: 'views/home.html',
    controller: 'HomeCtrl'
  })
  .when('/stores/:store_id', {
    templateUrl: 'views/store.html',
    controller: 'StoreCtrl'
  })
  .when('/purchases', {
    templateUrl: 'views/purchases.html',
    controller: 'PurchasesCtrl'
  })
  .when('/settings', {
    templateUrl: 'views/settings.html',
    controller: 'SettingsCtrl'
  })
  .when('/api', {
    templateUrl: 'views/api.html',
    controller: 'ApiCtrl'
  })
  .otherwise('/');
  $locationProvider.html5Mode(true);
}])
.config(['$mdThemingProvider', $mdThemingProvider => {
  $mdThemingProvider.theme('default').primaryPalette('blue-grey').accentPalette('grey');
  $mdThemingProvider.theme('dark').backgroundPalette('blue-grey').dark();
}])
.directive('productTile', ['$animate', $animate => ({
  transclude: true,
  templateUrl: 'views/partials/product_tile.html',
  link: (scope, element, attr) => {
    element.attr('layout-fill', null);
    element.on('click', () => {
      element.removeClass('jello pulse');
      $animate.addClass(element, 'pulse')
      .then(() => element.removeClass('jello pulse'));
    });
  }
})])
.directive('productImage', () => (scope, element, attrs) => {
  const update = (id, v) => element.css({
    'background-image': `url(/api/v1/products/${id}/images/0?${v})`
  });
  scope.$watch(attrs.productImage, id => {
    let v = 0;
    update(id, v);
    scope.$on(`${id}/images`, () => update(id, ++v));
  });
})
.directive('focus', ['$timeout', $timeout => ({
  restrict: 'A',
  link: (scope, elem, attrs) => {
    scope.$watch(attrs.focus, val => val && $timeout(() => elem[0].focus()));
  }
})])
.service('Toolbar', function() {
  this.config = function(title, search, menu) {
    this.title = title;
    this.search.config(search);
    this.menu.config(menu);
  };
  this.title = '';
  this.search = {
    config(search) {
      this.available = !!(this.placeholder = search);
      this.query = '';
      this.active = false;
    },
    available: false,
    active: false,
    toggle() {
      this.active = !this.active;
      this.query = ''; 
    },
    query: '',
    placeholder: ''
  };
  this.menu = {
    config(menu) {
      this.available = (this.items = menu) && menu.length;
    },
    available: false,
    items: []
  };
})
.controller('SidenavMenuCtrl', ['$scope', '$mdSidenav', function($scope, $mdSidenav) {
  this.toggle = $mdSidenav('menu').toggle;
  $scope.$on('$routeChangeStart', () => $mdSidenav('menu').close());
}])
.controller('ToolbarCtrl', ['$scope', 'Toolbar', ($scope, Toolbar) => $scope.toolbar = Toolbar])
.controller('MainCtrl', ['$scope', '$mdSidenav', '$location', '$http', '$cookies', '$mdMedia', '$mdDialog', ($scope, $mdSidenav, $location, $http, $cookies, $mdMedia, $mdDialog) => {
  $http.get('/api/v1/users/me')
  .then(res => $scope.user = res.data);
  $http.get('/api/v1/stores')
  .then(res => {
    $scope.stores = res.data.stores;
    if ($scope.stores.length) {
      $scope.theme.color = $scope.stores[0].metadata.color;
    }
  });
  $scope.theme = {};
  $scope.$on('$routeChangeSuccess', () => $scope.theme.color = '');
  $scope.createStore = ev =>
    $mdDialog.show($mdDialog.prompt()
      .title('Create store')
      .placeholder('Name')
      .ariaLabel('Name')
      .targetEvent(ev)
      .ok('Create')
      .cancel('Cancel'))
    .then(name => $http.post(`/api/v1/stores`, {name}))
    .then(() => $http.get('/api/v1/stores'))
    .then(res => ($scope.stores = res.data.stores));
}])
.controller('HomeCtrl', ['$scope', '$http', '$timeout', 'Toolbar', function($scope, $http, $timeout, Toolbar) {
  $scope.$watch('user', user => user && Toolbar.config(user.name));
  $http.get('/api/v1/purchases?limit=5')
  .then(res => $scope.recentpurchases = res.data.purchases);
  $scope.$on('purchases', (event, purchase) => $scope.recentpurchases.push(purchase));
  $timeout(() => ($scope.payTooltip = true), 500);
  $scope.swishData = (store) => {
    if (!store.metadata.swish) {
      return '';
    }
    return encodeURI(JSON.stringify({
      version: 1,
      payee: {
        value: store.metadata.swish,
        editable: false
      },
      amount: {
        value: store.debt,
        editable: false
      },
      message: {
        value: store.name +' streckskuld',
        editable: true
      }
    }));
  };
}])
.controller('StoreProductsCtrl', ['$rootScope', '$scope', '$http', '$mdMedia', '$filter', '$mdDialog', '$mdToast', function($rootScope, $scope, $http, $mdMedia, $filter, $mdDialog, $mdToast) {
  $scope.theme.color = $scope.store.metadata.color;
  $http.get(`/api/v1/stores/${$scope.store._id}/products`)
  .then(res => $scope.products = res.data.products);
  // Purchase functions
  const price_threshold = 15;
  $scope.buy = ($event, product) => {
    if (product.price < price_threshold){
      sendPurchase(product);
    }
    else {
      $mdDialog.show($mdDialog.confirm()
      .title(product.name)
      .textContent(`Buy ${product.name} for ${$filter('currency')(product.price,'kr')}?`)
      .ok('Buy').cancel('Cancel')
      .targetEvent($event))
      .then(() => sendPurchase(product));
    }
  };
  function sendPurchase(product) {
    $http.post(`/api/v1/stores/${$scope.store._id}/purchases`, {product: product._id})
    .then(res => {
      let purchase = res.data;
      $rootScope.$broadcast('purchases', purchase);
      $scope.store.debt += purchase.price;
      $scope.store.purchases.count++;
      const time_since_last_ms = new Date(purchase.time) - new Date($scope.store.purchases.latest);
      { //if (!product.image && $mdMedia('xs') && time_since_last_ms > 15*60*1000) {
        queryImageCrowdsourcing();
      }
      $scope.store.purchases.latest = purchase.time;
    });
    function queryImageCrowdsourcing() {
      const updateImage = () => $scope.$broadcast(`${product._id}/images`);
      $mdToast.show({
        controller: 'ImageUploadCtrl',
        templateUrl: 'views/partials/image_upload.html',
        locals: {product, updateImage},
        bindToController: true,
        controllerAs: 'ctrl'
      });
    }
  }
}])
.controller('ImageUploadCtrl', ['$http', '$mdToast', function($http, $mdToast) {
  const product = this.product;
  const updateScope = this.updateImage;
  this.select = () => {
    const capture = document.getElementById('capture');
    capture.onchange = () => {
      var data = new FormData();
      data.append('image', capture.files[0]);
      $http.post(`/api/v1/products/${product._id}/images/0`, data, {
        headers: {'content-type': undefined},
        transformRequest: angular.identity
      })
      .then(updateScope);
    };
    capture.click();
  };
  this.hide = () => $mdToast.cancel();
}])
.controller('StoreCtrl', ['$routeParams', '$scope', '$http', '$window', '$location', '$mdMedia', 'Toolbar', function($routeParams, $scope, $http, $window, $location, $mdMedia, Toolbar) {
  $scope.$watch('stores', stores => stores && load(stores));
  function load(stores) {
    // Lookup store
    let store = stores.find(store => store._id == $routeParams.store_id);
    if (!store) {
      return $location.path('#');
    }
    Toolbar.config(store.name, 'Product');
    $scope.store = store;
  }
  $scope.search = Toolbar.search;
}])
.controller('PurchasesCtrl', ['$scope', '$http', 'PurchasesList', '$filter', 'Toolbar', function($scope, $http, PurchasesList, $filter, Toolbar) {
  Toolbar.config('Purchase History');
  $scope.items = new PurchasesList();
}])
.directive('negate', () => ({
  require: 'ngModel',
  link: (scope, elm, attrs, ctrl) => {
    let pattern = ctrl.$validators.pattern;
    ctrl.$validators.pattern = (modelValue, viewValue) => !pattern(modelValue, viewValue);
  }
}))
.controller('SettingsCtrl', ['$scope', '$http', 'Toolbar', '$mdToast', '$mdDialog', '$q', function($scope, $http, Toolbar, $mdToast, $mdDialog, $q) {
  Toolbar.config('Settings');
  $scope.emailChangeRequested = false;
  $scope.update = function(name, email) {
    $q.all([
      $scope.updateEmail(email).catch(() => false),
      $scope.updateProfile(name)
    ])
    .then(res => {
      const emailUpdated = res[0];
      return $mdToast.showSimple(emailUpdated ? 'Confirmation email sent!' : 'Info updated!');
    });
  };
  $scope.updateProfile = function(name) {
    return $http.put('/api/v1/users/me', {name})
    .then(res => ($scope.user.name = name));
  };
  $scope.updateEmail = function(email) {
    if ($scope.emailChangeRequested || email == $scope.user.email) {
      return $q.reject();
    }
    return $http.put('/update/email', {email})
    .then(res => ($scope.emailChangeRequested = true));
  };
  $scope.updatePassword = function(data) {
    $http.put('/update/password', data)
    .then(function(res) {
      passwordForm.reset();
      $mdToast.showSimple('Password updated!');
    }, function(res) {
      $scope.passwordForm.old.$setValidity('incorrect', false);
    });
  };
  $scope.forgotPassword = function(ev) {
    $mdDialog.show($mdDialog.confirm()
    .title('Password recovery')
    .textContent(`Send recovery email to ${$scope.user.email}?`)
    .ok('Send').cancel('Cancel')
    .targetEvent(ev))
    .then(() => {
      $http.post('/api/v1/users/me/recover')
      .then(res => $mdToast.showSimple('Recovery email sent!'));
    });
  };
}])
.controller('ApiCtrl', ['$scope', '$http', '$sanitize', 'Toolbar', function($scope, $http, $sanitize, Toolbar) {
  Toolbar.config('Developer');
  $http.get('/api/v1/users/me/token')
  .then(res => $scope.token = res.data.token);
  $scope.copy = id => {
    document.getElementById(id).select();
    document.execCommand('copy');
  }
  $http.get('/api/user.md')
  .then(res => $http.post('https://api.github.com/markdown', {text: res.data}))
  .then(res => $scope.docs = $sanitize(res.data));
}]);