angular.module('app', ['ngMaterial', 'ngMessages'])
.config(function($mdThemingProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $mdThemingProvider.theme('default').primaryPalette('blue-grey');
});