import Vue from 'vue'

import VueResource from 'vue-resource'
Vue.use(VueResource);

import VueMaterial from 'vue-material'
Vue.use(VueMaterial);
Vue.material.registerTheme('default', {primary: 'blue-grey'});

import 'vue-material-css';

import App from './App.vue'

new Vue({
  el: '#app',
  render: h => h(App)
})
