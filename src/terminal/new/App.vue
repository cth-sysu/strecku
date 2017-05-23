<template>
  <div>
    <toolbar :title="store.name" :style="store.metadata"></toolbar>
    <h2>Purchases</h2>
    <!-- <purchase-list></purchase-list> -->

    <md-layout style="max-height:300px; overflow: scroll">
      <md-list>
        <md-list-item v-for="item in list3" v-async:list3="fetch" :key="item">
          ${{item}}
        </md-list-item>
      </md-list>
    </md-layout>

    <md-layout md-row>
      <md-layout md-flex="50">
        <md-list>
          <md-list-item
              v-for="item in list" v-async:list="fetch"
              :loading.sync="loading"
              :enabled="enable"
              :threshold="200"
              :key="item.n.m">
            #{{item.n.m}} ({{loading}}, {{list.length}})
          </md-list-item>
        </md-list>
      </md-layout>
      <md-layout md-flex="50" style="background: yellow; max-height:450px; overflow: scroll">
        <md-list class="md-dense">
          <md-list-item
              v-for="item in list2" v-async:list2="fetch"
              :loading.sync="loading"
              :enabled="enable"
              :threshold="100"
              :key="item">
            %{{item}}
          </md-list-item>
        </md-list>
      </md-layout>
    </md-layout>
    <!-- <md-spinner v-if="loading" md-indeterminat style="margin: auto"></md-spinner> -->
  </div>
</template>

<script>
import Vue from 'vue';
import Toolbar from './Toolbar.vue';
import PurchaseList from './PurchaseList.vue';

// import {async} from './vue-for-async';

import VueAsyncFor from '/Users/hultman/private/vue-async-for/src/index.js';
Vue.use(VueAsyncFor);

export default {
  name: 'app',
  data() {
    return {
      store: {},
      enable: false,
      loading: false,
      list: [],
      list2: [],
      list3: []
    }
  },
  mounted() {
    this.fetch(0).then(data => this.list = data);
    this.fetch(230).then(data => this.list3 = data);
    this.fetch(100).then(data => this.list2 = data);
  },
  methods: {
    fetch(n) {
      return new Promise(resolve => {
        setTimeout(() => {
          let arr = [];
          for (let i = 0; i < 16; i++) {
            arr.push({
              n : {
                m: (n || 0) + i
              }
            });
          }
          resolve(n > 1000 ? [] : arr);
        }, 1500);
      });
    },
    purchases(n) {
      this.$http
    }
  },
  created() {
    this.$http.get('/api/v1/stores/this')
    .then(res => res.json())
    .then(store => this.store = store);
  },
  components: {Toolbar, PurchaseList},
  // directives: {async}
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

h1, h2 {
  font-weight: normal;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline-block;
  margin: 0 10px;
}

a {
  color: #42b983;
}
</style>
