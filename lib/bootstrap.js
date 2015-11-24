'use strict';

var express = require('express');
var errorHandler = require('errorhandler');
var dolphin = require('dolphinio');
var KNExceptionHandler = require('dolphin-lib').KNExceptions.KNExceptionHandler;
var config = dolphin.loadConfig();
var appPath = process.cwd();

module.exports = function (options, db) {

    function isAjax(req) {
        return req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
    }

    // Register app dependency;
    dolphin.register('app', function (access, database) {
        require(appPath + '/config/express')(app, access.passport, database.connection);
        access.routes(app);
        return app;
    });

    // Express settings
    var app = express();

    app.get('/modules/aggregated.js', function (req, res) {
        res.setHeader('content-type', 'text/javascript');
        dolphin.aggregated('js', req.query.group ? req.query.group : 'footer', function (data) {
            res.send(data);
        });
    });

    app.get('/modules/aggregated.css', function (req, res) {
        res.setHeader('content-type', 'text/css');
        dolphin.aggregated('css', req.query.group ? req.query.group : 'header', function (data) {
            res.send(data);
        });
    });

    app.use('/bower_components', express.static(config.root + '/bower_components'));
    dolphin.events.on('modulesEnabled', function () {

        for (var name in dolphin.modules) {
            app.use('/' + name, express.static(config.root + '/' + dolphin.modules[name].source + '/' + name.toLowerCase() + '/public'));
        }

        // We are going to catch everything else here
        app.route('*').get(function (req, res, next) {
            if (isAjax(req)) {
                return res.status(404).send('Page not found');
            }
            dolphin.defaultRender(req, res, next);
        });

        //inject error handlers from modules
        for (var moduleName in dolphin.modules) {
            if (dolphin.modules.hasOwnProperty(moduleName)) {
                var module = dolphin.load(moduleName);
                module.getErrorHandlers().forEach(function (errorHandler) {
                    require(errorHandler)(app);
                });
            }
        }

        //global exceptions
        app.use(KNExceptionHandler);

        app.use(function (err, req, res, next) {
            if (err.errorCode && err.errorCode == '403') {
                return res.status(403).send('Not authorized');
            }

            //return error;
            return res.status(400).send(err.message);
        });

        // Error handler - has to be last
        if (process.env.NODE_ENV === 'development') {
            app.use(errorHandler());
        }

        //finish
        dolphin.events.emit('bootstrapLoaded');
    });

    return app;
};
