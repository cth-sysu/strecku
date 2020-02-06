/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/static/strecku/";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 5);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


angular.module('strecku.datefilter', []).filter('dynamicDate', ['$filter', function ($filter) {
  return function (date, format, timezone) {
    date = new Date(date);
    if (Date.now() - date < 604800000) {
      // 1 week
      return $filter('date')(date, 'EEE', timezone);
    } else if (date.getFullYear() === new Date().getFullYear()) {
      // This year
      return $filter('date')(date, 'd/M', timezone);
    }
    return $filter('date')(date, 'd/M/yy', timezone);
  };
}]);
angular.module('strecku.volumefilter', []).filter('volume', ['$filter', function ($filter) {
  return function (volume) {
    volume = parseInt(volume) / 10;
    if (volume >= 100) {
      return $filter('number')(volume / 100, 0) + 'l';
    }
    return $filter('number')(volume, 0) + 'cl';
  };
}]);

/***/ }),
/* 1 */,
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


angular.module('strecku.codescanner', []).directive('codeScanner', function () {
    return {
        restrict: 'A',
        link: function link(scope, element, attr) {
            var $code = '';
            element.on('keypress', function (ev) {
                if ($code && ev.keyCode == 13 || ev.keyCode == 35) {
                    scope.$eval(attr.codeScanner, { $code: $code });
                    return $code = '';
                }
                var c = String.fromCharCode(ev.which);
                if (/\d/.test(c)) $code += c;
            });
        }
    };
});

/***/ }),
/* 3 */,
/* 4 */,
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


__webpack_require__(2);
__webpack_require__(0);

angular.module('strecku.terminal', ['strecku.codescanner', 'strecku.datefilter', 'strecku.volumefilter', 'ngMaterial', 'ngMessages', 'ngRoute', 'ngCookies', 'ngAnimate', 'btford.socket-io']).config(['$mdThemingProvider', function ($mdThemingProvider) {
    $mdThemingProvider.theme('default').primaryPalette('blue-grey').accentPalette('grey');
    $mdThemingProvider.theme('dark').backgroundPalette('blue-grey').dark();
}]).factory('StoreLog', ['socketFactory', function (socketFactory) {
    return socketFactory();
}]).controller('MainCtrl', ['$scope', '$q', '$http', '$mdDialog', '$timeout', 'StoreLog', function ($scope, $q, $http, $mdDialog, $timeout, StoreLog) {
    // Get store name
    $http.get('/api/v1/stores/this').then(function (res) {
        $scope.store = res.data;
    });

    // Log entries
    $http.get('/api/v1/purchases?limit=25').then(function (res) {
        console.log(res);
        $scope.log = res.data.purchases;
        // Listen to new in realtime
        StoreLog.on('purchase', function (purchase) {
            return console.log(purchase);
        });
        // $scope.log.push(purchase));
    }).catch(function (err) {
        return console.error('err', err);
    });

    // Additional user data
    $scope.$watch('item.user', function (user) {
        if (user) $q.all([$http.get('/api/v1/stores/this/purchases?user=' + user._id + '&limit=5'), $http.get('/api/v1/stores/this/summary?user=' + user._id)]).then(function (res) {
            $scope.item.purchases = res[0].data;
            $scope.item.summary = res[1].data;
        });
    });

    // Code scanner callback
    $scope.onCode = function (code) {
        $http.get('/api/v1/codes/' + code).then(function (res) {
            return res.data;
        }).then(onItem, onNull.bind(this, code));
    };
    // Code item callbacks
    function onItem(item) {
        // Cancel code confirm
        if ($scope.codeConfirm) {
            $mdDialog.cancel();
        }
        // Scan twice -> reset
        else if (isCurrent(item)) {
                $scope.item = null;
            }
            // user -> product = purchase
            else if ($scope.item && $scope.item.user && item.product) {
                    buyProduct($scope.item.user._id, item.product._id);
                }
                // product -> user = purchase
                else if ($scope.item && $scope.item.product && item.user) {
                        buyProduct(item.user._id, $scope.item.product._id);
                    }
                    // Set/reset current
                    else {
                            timeout();
                            $scope.item = item;
                        }
    }
    function onNull(code) {
        // Finish/cancel code confirm
        if ($scope.codeConfirm) {
            $scope.codeConfirm == code ? $mdDialog.hide(code) : $mdDialog.cancel();
        }
        // user -> new code = add to user
        else if ($scope.item && $scope.item.user) {
                addCode($scope.item.user, code).then(function (code) {
                    console.log('Add user code', code);
                    timeout();
                }, timeout);
            }
            // product -> new code = add to product
            else if ($scope.item && $scope.item.product) {
                    addCode($scope.item.product, code).then(function (code) {
                        console.log('Add product code', code);
                        timeout();
                    }, timeout);
                }
                // Reset current
                else $scope.item = null;
    }

    // Helper functions
    function isCurrent(item) {
        return $scope.item && ($scope.item.user && item.user && $scope.item.user._id == item.user._id || $scope.item.product && item.product && $scope.item.product._id == item.product._id);
    }
    function timeout() {
        $scope.codeConfirm = null;
        $timeout.cancel($scope.timeout);
        ($scope.timeout = $timeout(30000)).then(function () {
            if (!$scope.codeConfirm) $scope.item = null;
        });
    }
    // Action implementations
    function buyProduct(user, product) {
        return $http.post('/api/v1/stores/this/purchases', { user: user, product: product });
    };
    function addCode(target, code) {
        $scope.codeConfirm = code;
        return $mdDialog.show({
            controller: function controller() {},
            templateUrl: 'views/add_code.html',
            clickOutsideToClose: true,
            locals: { code: code, target: target },
            bindToController: true,
            controllerAs: 'ctrl'
        }).then(function () {
            return code;
        });
    }
}]);

/***/ })
/******/ ]);