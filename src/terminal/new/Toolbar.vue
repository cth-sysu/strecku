<template>
  <md-toolbar>
    <md-button class="md-icon-button">
      <md-icon md-src="./assets/logo.png"></md-icon>
    </md-button>
    <h1 class="md-title">{{title}}</h1>
  </md-toolbar>
</template>

<script>
export default {
  name: 'toolbar',
  props: ['title']
}
</script>
