var path = require('path');
var defaults = require('lodash/defaults');

var baseConfig = require('./karma.base.config');
var baseDir = 'unit';
var suffix = '.spec.js';
var tests = (process.env.npm_config_tests || '**/*').split(',');

module.exports = function (config) {
    config.set(defaults({
        files: (baseConfig.files || []).concat(tests.reduce(function (result, file) {
            result.push(path.join(baseDir, file + suffix), path.join(baseDir, file, '**/*' + suffix));
            return result;
        }, []))
    }), baseConfig);
};
