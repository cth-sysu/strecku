!function(t){function e(r){if(n[r])return n[r].exports;var o=n[r]={i:r,l:!1,exports:{}};return t[r].call(o.exports,o,o.exports,e),o.l=!0,o.exports}var n={};e.m=t,e.c=n,e.i=function(t){return t},e.d=function(t,n,r){e.o(t,n)||Object.defineProperty(t,n,{configurable:!1,enumerable:!0,get:r})},e.n=function(t){var n=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(n,"a",n),n},e.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},e.p="/static/strecku/",e(e.s=3)}([function(t,e,n){"use strict";angular.module("strecku.datefilter",[]).filter("dynamicDate",["$filter",function(t){return function(e,n,r){return e=new Date(e),Date.now()-e<6048e5?t("date")(e,"EEE",r):e.getFullYear()===(new Date).getFullYear()?t("date")(e,"d/M",r):t("date")(e,"d/M/yy",r)}}]),angular.module("strecku.volumefilter",[]).filter("volume",["$filter",function(t){return function(e){return e=parseInt(e)/10,e>=100?t("number")(e/100,0)+"l":t("number")(e,0)+"cl"}}])},function(t,e,n){"use strict";angular.module("strecku.purchases",[]).service("PurchasesList",["$http","$timeout",function(t,e){var n=function(t){this.items={},this.length=-1,this.url=t?"/api/v1/stores/"+t+"/purchases":"/api/v1/purchases",this.reload()};return n.prototype._fetchPage=function(e){var n=this;this.items[e]=null,t.get(this.url+"?limit=50&offset="+50*e+(this.user?"&user="+this.user._id:"")).then(function(t){return n.items[e]=t.data.purchases})},n.prototype.initialized=!1,n.prototype.reload=function(){var e=this;this.items=[],t.get(this.url+"/count"+(this.user?"?user="+this.user._id:"")).then(function(t){return e.length=t.data.count})},n.prototype.filterUser=function(t){this.user=t,this.reload()},n.prototype.getItemAtIndex=function(t){var e=Math.floor(t/50),n=this.items[e];if(n)return n[t%50];null!==n&&this._fetchPage(e)},n.prototype.getLength=function(){return this.length},n}])},,function(t,e,n){"use strict";n(0),n(1),angular.module("strecku.client",["strecku.datefilter","strecku.purchases","ngMaterial","ngMessages","ngRoute","ngCookies","ngAnimate","ngSanitize"]).config(["$compileProvider",function(t){t.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|swish):/)}]).config(["$routeProvider","$locationProvider",function(t,e){t.when("/",{templateUrl:"views/home.html",controller:"HomeCtrl"}).when("/stores/:store_id",{templateUrl:"views/store.html",controller:"StoreCtrl"}).when("/purchases",{templateUrl:"views/purchases.html",controller:"PurchasesCtrl"}).when("/settings",{templateUrl:"views/settings.html",controller:"SettingsCtrl"}).when("/api",{templateUrl:"views/api.html",controller:"ApiCtrl"}).otherwise("/"),e.html5Mode(!0)}]).config(["$mdThemingProvider",function(t){t.theme("default").primaryPalette("blue-grey").accentPalette("grey"),t.theme("dark").backgroundPalette("blue-grey").dark()}]).directive("productTile",["$animate",function(t){return{transclude:!0,templateUrl:"views/partials/product_tile.html",link:function(e,n,r){n.attr("layout-fill",null),n.on("click",function(){n.removeClass("jello pulse"),t.addClass(n,"pulse").then(function(){return n.removeClass("jello pulse")})})}}}]).directive("productImage",function(){return function(t,e,n){var r=function(t,n){return e.css({"background-image":"url(/api/v1/products/"+t+"/images/0?"+n+")"})};t.$watch(n.productImage,function(e){var n=0;r(e,n),t.$on(e+"/images",function(){return r(e,++n)})})}}).directive("focus",["$timeout",function(t){return{restrict:"A",link:function(e,n,r){e.$watch(r.focus,function(e){return e&&t(function(){return n[0].focus()})})}}}]).service("Toolbar",function(){this.config=function(t,e,n){this.title=t,this.search.config(e),this.menu.config(n)},this.title="",this.search={config:function(t){this.available=!!(this.placeholder=t),this.query="",this.active=!1},available:!1,active:!1,toggle:function(){this.active=!this.active,this.query=""},query:"",placeholder:""},this.menu={config:function(t){this.available=(this.items=t)&&t.length},available:!1,items:[]}}).controller("SidenavMenuCtrl",["$scope","$mdSidenav",function(t,e){this.toggle=e("menu").toggle,t.$on("$routeChangeStart",function(){return e("menu").close()})}]).controller("ToolbarCtrl",["$scope","Toolbar",function(t,e){return t.toolbar=e}]).controller("MainCtrl",["$scope","$mdSidenav","$window","$location","$http","$cookies","$mdMedia","$mdDialog",function(t,e,n,r,o,i,a,u){o.get("/api/v1/users/me").then(function(e){return t.user=e.data}).catch(function(t){401===t.status&&(n.location.href="/login")}),o.get("/api/v1/stores").then(function(e){t.stores=e.data.stores,t.stores.length&&(t.theme.color=t.stores[0].metadata.color)}),t.theme={},t.$on("$routeChangeSuccess",function(){return t.theme.color=""}),t.createStore=function(e){return u.show(u.prompt().title("Create store").placeholder("Name").ariaLabel("Name").targetEvent(e).ok("Create").cancel("Cancel")).then(function(t){return o.post("/api/v1/stores",{name:t})}).then(function(){return o.get("/api/v1/stores")}).then(function(e){return t.stores=e.data.stores})}}]).controller("HomeCtrl",["$scope","$http","$timeout","Toolbar",function(t,e,n,r){t.$watch("user",function(t){return t&&r.config(t.name)}),e.get("/api/v1/purchases?limit=5").then(function(e){return t.recentpurchases=e.data.purchases}),t.$on("purchases",function(e,n){return t.recentpurchases.push(n)}),n(function(){return t.payTooltip=!0},500),t.swishData=function(e){if(!e.metadata.swish)return"";var n=t.user?t.user.name:"",r=e.name+": "+n;return encodeURI(JSON.stringify({version:1,payee:{value:e.metadata.swish,editable:!1},amount:{value:e.debt,editable:!1},message:{value:r.substr(0,50),editable:!0}}))}}]).controller("StoreProductsCtrl",["$rootScope","$scope","$http","$mdMedia","$filter","$mdDialog","$mdToast",function(t,e,n,r,o,i,a){function u(r){function o(){var t=function(){return e.$broadcast(r._id+"/images")};a.show({controller:"ImageUploadCtrl",templateUrl:"views/partials/image_upload.html",locals:{product:r,updateImage:t},bindToController:!0,controllerAs:"ctrl"})}n.post("/api/v1/stores/"+e.store._id+"/purchases",{product:r._id}).then(function(n){var r=n.data;t.$broadcast("purchases",r),e.store.debt+=r.price,e.store.purchases.count++;new Date(r.time),new Date(e.store.purchases.latest);o(),e.store.purchases.latest=r.time})}e.theme.color=e.store.metadata.color,n.get("/api/v1/stores/"+e.store._id+"/products").then(function(t){return e.products=t.data.products});e.buy=function(t,e){e.price<15?u(e):i.show(i.confirm().title(e.name).textContent("Buy "+e.name+" for "+o("currency")(e.price,"kr")+"?").ok("Buy").cancel("Cancel").targetEvent(t)).then(function(){return u(e)})}}]).controller("ImageUploadCtrl",["$http","$mdToast",function(t,e){function n(t){return new Promise(function(e){var n=new FileReader;n.onload=function(t){var n=new Image;n.onload=function(){var t=document.createElement("canvas"),r=t.getContext("2d");t.width=256,t.height=256,r.drawImage(n,Math.max(0,(n.width-n.height)/2),Math.max(0,(n.height-n.width)/2),n.width-Math.max(0,n.width-n.height),n.height-Math.max(0,n.height-n.width),0,0,t.width,t.height),e(t.toDataURL())},n.src=t.target.result},n.readAsDataURL(t)}).then(function(t){return fetch(t)}).then(function(t){return t.blob()}).then(function(t){return new File([t],"image")})}var r=this.product,o=this.updateImage;this.select=function(){var e=document.getElementById("capture");e.onchange=function(){n(e.files[0]).then(function(e){var n=new FormData;n.append("image",e),t.post("/api/v1/products/"+r._id+"/images/0",n,{headers:{"content-type":void 0},transformRequest:angular.identity}).then(o)})},e.click()},this.hide=function(){return e.cancel()}}]).controller("StoreCtrl",["$routeParams","$scope","$http","$window","$location","$mdMedia","Toolbar",function(t,e,n,r,o,i,a){function u(n){var r=n.find(function(e){return e._id==t.store_id});if(!r)return o.path("#");a.config(r.name,"Product"),e.store=r}e.$watch("stores",function(t){return t&&u(t)}),e.search=a.search}]).controller("PurchasesCtrl",["$scope","$http","PurchasesList","$filter","Toolbar",function(t,e,n,r,o){o.config("Purchase History"),t.items=new n}]).directive("negate",function(){return{require:"ngModel",link:function(t,e,n,r){var o=r.$validators.pattern;r.$validators.pattern=function(t,e){return!o(t,e)}}}}).controller("SettingsCtrl",["$scope","$http","Toolbar","$mdToast","$mdDialog","$q",function(t,e,n,r,o,i){n.config("Settings"),t.emailChangeRequested=!1,t.update=function(e,n){i.all([t.updateEmail(n).catch(function(){return!1}),t.updateProfile(e)]).then(function(t){var e=t[0];return r.showSimple(e?"Confirmation email sent!":"Info updated!")})},t.updateProfile=function(n){return e.put("/api/v1/users/me",{name:n}).then(function(e){return t.user.name=n})},t.updateEmail=function(n){return t.emailChangeRequested||n==t.user.email?i.reject():e.put("/update/email",{email:n}).then(function(e){return t.emailChangeRequested=!0})},t.updatePassword=function(n){e.put("/update/password",n).then(function(t){passwordForm.reset(),r.showSimple("Password updated!")},function(e){t.passwordForm.old.$setValidity("incorrect",!1)})},t.forgotPassword=function(n){o.show(o.confirm().title("Password recovery").textContent("Send recovery email to "+t.user.email+"?").ok("Send").cancel("Cancel").targetEvent(n)).then(function(){e.post("/api/v1/users/me/recover").then(function(t){return r.showSimple("Recovery email sent!")})})}}]).controller("ApiCtrl",["$scope","$http","$sanitize","Toolbar",function(t,e,n,r){r.config("Developer"),e.get("/api/v1/users/me/token").then(function(e){return t.token=e.data.token}),t.copy=function(t){document.getElementById(t).select(),document.execCommand("copy")},e.get("/api/user.md").then(function(t){return e.post("https://api.github.com/markdown",{text:t.data})}).then(function(e){return t.docs=n(e.data)})}])}]);