angular.module('strecku.datefilter', [])
.filter('dynamicDate', ['$filter', $filter => (date, format, timezone) => {
  date = new Date(date);
  if (Date.now() - date < 604800000) { // 1 week
    return $filter('date')(date, 'EEE', timezone);
  } else if (date.getFullYear() === new Date().getFullYear()) { // This year
    return $filter('date')(date, 'd/M', timezone);
  }
  return $filter('date')(date, 'd/M/yy', timezone);
}]);
angular.module('strecku.volumefilter', [])
.filter('volume', ['$filter', $filter => volume => {
  volume = parseInt(volume) / 10;
  if (volume >= 100) {
    return $filter('number')(volume / 100, 0) + 'l';
  }
  return $filter('number')(volume, 0) + 'cl';
}]);