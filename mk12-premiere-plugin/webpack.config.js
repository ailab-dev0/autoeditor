const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const panels = ['main', 'stock', 'transcript'];

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: Object.fromEntries(
      panels.map(p => [p, `./src/panels/${p}/index.jsx`])
    ),

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'panels/[name]/index.js',
      clean: true,
      library: { type: 'commonjs2' },
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
      ...panels.map(
        p =>
          new HtmlWebpackPlugin({
            template: `./src/panels/${p}/index.html`,
            filename: `panels/${p}/index.html`,
            chunks: [p],
          })
      ),
      new CopyWebpackPlugin({
        patterns: [{ from: 'plugin', to: '.' }],
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
    },
  };
};
