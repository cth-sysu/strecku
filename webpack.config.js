const path = require('path')

module.exports = {
  context: path.join(__dirname),
  entry: {
    client: './src/client/app.js',
    admin: './src/admin/app.js',
    terminal: './src/terminal/app.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.join(__dirname, 'static', 'strecku'),
    publicPath: '/static/strecku/'
  },
  module: {
    rules: [
      // {
      //   test: /\.vue$/,
      //   loader: 'vue-loader',
      //   options: {
      //     loaders: {},
      //     transformToRequire: {
      //       ['md-icon']: 'md-src'
      //     }
      //   }
      // },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {presets: ['env']}
      },
      {
        test: /\.css$/, use: ['style-loader', 'css-loader']}, {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {name: '[name].[ext]?[hash]'}
      }
    ]
  },
  resolve: {
    alias: {
        // 'vue$': 'vue/dist/vue.esm.js',
        // 'vue-material-css$': 'vue-material/dist/vue-material.css'
    }
  },
  devServer: {
    historyApiFallback: true,
    publicPath: '/',
    contentBase: false,
    noInfo: true,
    proxy: [{
      context: ['!**/*.bundle.js'],
      target: 'http://localhost:5100',
    }],
    host: '0.0.0.0'
  }
};
