angular.module('strecku.codescanner', [])
    .directive('codeScanner', function(){
        return {
            restrict: 'A',
            link: function(scope, element, attr){
                var $code = '';
                element.on('keypress', function(ev){
                    if ($code && ev.keyCode == 13 || ev.keyCode == 35) {
                        scope.$eval(attr.codeScanner, { $code });
                        return $code = '';
                    }
                    var c = String.fromCharCode(ev.which);
                    if (/\d/.test(c)) $code += c;
                });
            }
        };
    });