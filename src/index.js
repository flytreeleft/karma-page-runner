// https://github.com/assaf/zombie
// https://github.com/karma-runner/karma
// https://karma-runner.github.io/1.0/config/plugins.html
// https://karma-runner.github.io/latest/config/configuration-file.html
var path = require('path');
var fs = require('fs');
var mime = require('mime');

var runnerConfig = require('./config');

var sendError = function (response, code, msg) {
    response.writeHead(code);
    return response.end(msg || '');
};

var sendFile = function (file, response) {
    fs.readFile(file, function (error, data) {
        if (error) {
            return sendError(response, 500, error.message);
        }

        response.setHeader('Content-Type', mime.lookup(file, 'text/plain'));
        response.writeHead(200);
        return response.end(data);
    });
};

var createPattern = function (path) {
    return {pattern: path, included: true, served: true, watched: false};
};

var frameworkFactory = function (files, config) {
    files.unshift(createPattern(path.join(__dirname, 'runner.css')));
    files.unshift(createPattern(path.join(__dirname, 'adapter.js')));

    config.middleware = config.middleware || [];
    config.middleware.unshift(runnerConfig.name);
};

frameworkFactory.$inject = ['config.files', 'config'];

var middlewareFactory = function (logger, basePath, config) {
    // https://nodejs.org/api/http.html#http_class_http_incomingmessage
    // https://nodejs.org/api/http.html#http_class_http_clientrequest
    // https://nodejs.org/api/http.html#http_class_http_serverresponse
    return function (request, response, next) {
        var parsedURL = require('url').parse(request.url, true);
        var requestUrl = parsedURL.pathname;
        if (!requestUrl.startsWith(runnerConfig.context + '/')) {
            return next();
        }

        var urlPath = requestUrl.substring(runnerConfig.context.length);
        switch (urlPath) {
            case '/page':
                var filePath = path.join(basePath, parsedURL.query.path);
                return sendFile(filePath, response);
            default:
                return sendError(response, 404, 'Unknown path: ' + urlPath);
        }
    };
};

middlewareFactory.$inject = ['logger', 'config.basePath', 'config'];

module.exports = {};
module.exports['framework:' + runnerConfig.name] = ['factory', frameworkFactory];
module.exports['middleware:' + runnerConfig.name] = ['factory', middlewareFactory];
