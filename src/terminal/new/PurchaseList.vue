<template>
  <md-list class="md-double-line">
    <md-list-item v-for="purchase in purchases" :key="purchase._id">
      <div class="md-list-text-container">
        <span>{{purchase.product.name}}</span>
        <span>{{purchase.user.name}}</span>
      </div>
    </md-list-item>
  </md-list>
</template>

<script>
import Vue from 'vue';
import VueSocketio from 'vue-socket.io';
import io from 'socket.io-client';
Vue.use(VueSocketio, io('/', {
  path: '/api/streaming/v1'
}));
export default {
  name: 'purchase-list',
  data () {
    return {
      purchases: []
    }
  },
  sockets: {
    purchase(purchase) {
      this.purchases.push(purchase);
    }
  },
  // methods: {
  //   clickButton(val) {
  //     this.$socket.emit('emit_method', val);
  //   }
  // }
}
</script>

<style>
/*#list {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}*/
</style>
