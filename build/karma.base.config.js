var path = require('path');

var debug = process.env.npm_config_debug === 'true';
var browsers = process.env.npm_config_browsers ? process.env.npm_config_browsers.split(',') : [];

var BROWSERS = {
    'phantomjs': 'PhantomJS',
    'chrome': 'Chrome',
    'firefox': 'Firefox',
    'safari': 'Safari',
    'opera': 'Opera',
    'ie': 'IE'
};

// shared config for all unit tests
module.exports = {
    frameworks: ['mocha', 'chai', 'page-runner'],
    browsers: browsers.map(function (name) {
        return BROWSERS[name.toLowerCase()] || name;
    }),
    // The root path location that will be used to resolve
    // all relative paths defined in files and exclude.
    // If the basePath configuration is a relative path then
    // it will be resolved to the __dirname of the configuration file.
    basePath: path.resolve(__dirname, '../test'),
    // List of files/patterns to load in the browser:
    // **/*.js: All files with a "js" extension in all subdirectories
    // **/!(jquery).js: Same as previous, but excludes "jquery.js"
    // **/(foo|bar).js: In all subdirectories, all "foo.js" or "bar.js" files
    files: ['**/*.html'],
    preprocessors: {
        '**/*.html': ['html2js'],
        '**/*.js': ['webpack'],
        // NOTE: The base path will be prepended to the pattern,
        // so if the source files should be processed or compiled,
        // the relative path patterns should be used.
        '../src/**/*.js': ['webpack']
    },
    webpack: require('./webpack.test.config.js'),
    webpackMiddleware: {
        stats: 'errors-only'
    },
    reporters: ['progress'],
    autoWatch: true,
    browserDisconnectTimeout: 5 * 60 * 1000,
    listenAddress: '127.0.0.1',
    hostname: 'localhost',
    port: 9876,
    urlRoot: '/',
    singleRun: !debug,
    plugins: [
        'karma-*',
        require(path.resolve(__dirname, '../src'))
    ]
};
