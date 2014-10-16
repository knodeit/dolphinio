'use strict';

var express = require('express'),
    errorHandler = require('errorhandler'),
    config = require('dolphinio').loadConfig(),
    fs = require('fs'),
    appPath = process.cwd();

var mean = require('dolphinio');

module.exports = function (options, db) {

    // Register app dependency;
    mean.register('app', function (access, database) {
        require(appPath + '/config/express')(app, access.passport, database.connection);
        return app;
    });

    // Express settings
    var app = express();

    app.get('/modules/aggregated.js', function (req, res) {
        res.setHeader('content-type', 'text/javascript');
        mean.aggregated('js', req.query.group ? req.query.group : 'footer', function (data) {
            res.send(data);
        });
    });

    app.get('/modules/aggregated.css', function (req, res) {
        res.setHeader('content-type', 'text/css');
        mean.aggregated('css', req.query.group ? req.query.group : 'header', function (data) {
            res.send(data);
        });
    });

    app.use('/bower_components', express.static(config.root + '/bower_components'));
    mean.events.on('modulesEnabled', function () {

        for (var name in mean.modules) {
            app.use('/' + name, express.static(config.root + '/' + mean.modules[name].source + '/' + name.toLowerCase() + '/public'));
        }

        // We are going to catch everything else here
        app.route('*').get(function (req, res, next) {
            if (!mean.template) return next();
            mean.template(req, res, next);
        });

        // Assume "not found" in the error msgs is a 404. this is somewhat
        // silly, but valid, you can do whatever you like, set properties,
        // use instanceof etc.
        app.use(function (err, req, res, next) {
            // Treat as 404
            if (~err.message.indexOf('not found')) return next();

            // Log it
            console.error(err.stack);

            // Error page
            res.status(500).render('500', {
                error: err.stack
            });
        });

        // Assume 404 since no middleware responded
        app.use(function (req, res) {
            res.status(404).render('404', {
                url: req.originalUrl,
                error: 'Not found'
            });
        });

        // Error handler - has to be last
        if (process.env.NODE_ENV === 'development') {
            app.use(errorHandler());
        }
    });

    return app;
};
