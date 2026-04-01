const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/index.jsx',

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      clean: true,
    },

    devtool: isProd ? false : 'source-map',

    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: { chrome: '108' } }],
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
      new CopyWebpackPlugin({
        patterns: [
          { from: 'plugin', to: '.' },
          { from: 'src/index.html', to: 'index.html' },
        ],
      }),
    ],

    resolve: {
      extensions: ['.jsx', '.js'],
      alias: {
        react: 'preact/compat',
        'react-dom': 'preact/compat',
      },
    },

    externals: {
      premierepro: 'commonjs2 premierepro',
      uxp: 'commonjs2 uxp',
    },
  };
};
