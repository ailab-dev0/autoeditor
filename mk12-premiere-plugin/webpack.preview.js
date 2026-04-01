const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/preview.jsx',

  output: {
    path: path.resolve(__dirname, 'dist-preview'),
    filename: 'preview.js',
    clean: true,
  },

  devtool: 'source-map',

  devServer: {
    port: 9999,
    static: false,
    hot: true,
    open: true,
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { chrome: '110' } }],
              ['@babel/preset-react', { pragma: 'h', pragmaFrag: 'Fragment' }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/preview.html',
      filename: 'index.html',
    }),
  ],

  resolve: {
    extensions: ['.jsx', '.js'],
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      // Mock UXP and Premiere for browser
      uxp: path.resolve(__dirname, 'src/mocks/uxp.js'),
      premierepro: path.resolve(__dirname, 'src/mocks/premierepro.js'),
    },
  },
};
