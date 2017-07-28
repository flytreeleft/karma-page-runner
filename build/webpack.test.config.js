var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: path.resolve(__dirname, '../src/index'),
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            // , then parse es6 syntax
            use: ['babel-loader?cacheDirectory']
        }]
    },
    output: {
        path: path.resolve(__dirname, '../dist'),
        filename: '[name].js',
        publicPath: '/'
    },
    // Fix [Cannot resolve module 'fs'](https://github.com/postcss/postcss-js#cannot-resolve-module-fs)
    node: {
        fs: 'empty'
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('testing')
            }
        })
    ]
};
