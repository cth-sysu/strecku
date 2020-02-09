require('./codescanner');
require('../shared/filters');

angular.module('strecku.terminal', [
  'strecku.codescanner',
  'strecku.datefilter',
  'strecku.volumefilter',
  'ngMaterial',
  'ngMessages',
  'ngRoute',
  'ngCookies',
  'ngAnimate',
  'btford.socket-io'])
.config(['$mdThemingProvider', $mdThemingProvider => {
  $mdThemingProvider.theme('default').primaryPalette('blue-grey').accentPalette('grey');
  $mdThemingProvider.theme('dark').backgroundPalette('blue-grey').dark();
}])
.factory('StoreLog', ['socketFactory', socketFactory => {
  const ioSocket = io({ path: '/api/streaming/v1' });
  return socketFactory({ ioSocket });
}])
.controller('MainCtrl', ['$scope', '$q', '$http', '$mdDialog', '$timeout', 'StoreLog', function($scope, $q, $http, $mdDialog, $timeout, StoreLog){
        // Get store name
        $http.get('/api/v1/stores/this')
        .then(function(res){
            $scope.store = res.data;
        });

        // Log entries
        $http.get('/api/v1/purchases?limit=25').then(res => {
          $scope.log = res.data.purchases;
          // Listen to new in realtime
          StoreLog.on('purchase', (purchase) => $scope.log.push(purchase));
        })

        // Code scanner callback
        $scope.onCode = function(code){
            $http.get(`/api/v1/codes/${code}`)
            .then(function(res){
                return res.data;
            }).then(onItem, onNull.bind(this, code));
        };
        // Code item callbacks
        function onItem(item){
            // Cancel code confirm
            if ($scope.codeConfirm) {
                $mdDialog.cancel();
            }
            // Scan twice -> reset
            else if (isCurrent(item)){
                $scope.item = null;
            }
            // user -> product = purchase
            else if ($scope.item &&
                $scope.item.user && item.product){
                buyProduct($scope.item.user._id, item.product._id);
              $scope.item.user = null;
            }
            // product -> user = purchase
            else if ($scope.item &&
                $scope.item.product && item.user){
                buyProduct(item.user._id, $scope.item.product._id);
              $scope.item.user = null;
            }
            // Set/reset current
            else {
                timeout();
                if (item.type === 'user') {
                  $http.get(`/api/v1/purchases?user=${item.user._id}&limit=5`).then(res => {
                    item.purchases = res.data.purchases;
                    $scope.item = item;
                  });
                } else {
                  $scope.item = item;
                }
            }
        }
        function onNull(code){
            // Finish/cancel code confirm
            if ($scope.codeConfirm){
                $scope.codeConfirm == code ?
                    $mdDialog.hide(code) :
                    $mdDialog.cancel();
            }
            // user -> new code = add to user
            else if ($scope.item && $scope.item.user){
                addCode($scope.item.user, code).then(function(code){
                    console.log('Add user code', code);
                    timeout();
                }, timeout);
            }
            // product -> new code = add to product
            else if ($scope.item && $scope.item.product){
                addCode($scope.item.product, code).then(function(code){
                    console.log('Add product code', code);
                    timeout();
                }, timeout);
            }
            // cancel new code
            else if ($scope.item && $scope.item.pendingCode === code){
              $scope.item = null;
            }
            // new code = show list of users
            else {
              $http.get(`/api/v1/users`).then(res => {
                $scope.item = {
                  pendingCode: code,
                  users: res.data.users,
                };
              });
            }
        }

        // Helper functions
        function isCurrent(item){
            return $scope.item && (
            ($scope.item.user && item.user && 
            $scope.item.user._id == item.user._id) ||
            ($scope.item.product && item.product && 
            $scope.item.product._id == item.product._id));
        }
        function timeout(){
            $timeout.cancel($scope.timeout);
            ($scope.timeout = $timeout(5000)).then(() => {
              $scope.item = null;
            });
        }
        // Action implementations
        function buyProduct(user, product){
            return $http.post(`/api/v1/purchases`, { user, product });
        };
        function addCode(target, code){
            $timeout.cancel($scope.timeout);
            $scope.codeConfirm = code;
            return $mdDialog.show({
                controller: () => {},
                templateUrl: 'views/add_code.html',
                clickOutsideToClose: true,
                locals: { code, target },
                bindToController: true,
                controllerAs: 'ctrl'
            }).then(() => code);
        }

        $scope.assignCode = (code, user) => {
          $http.post(`/api/v1/users/${user._id}/codes`, { code });
          $scope.item = null;
        };
    }]);