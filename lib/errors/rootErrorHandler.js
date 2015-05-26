'use strict';
var errors = require('./errors');

module.exports.handler = function (err, req, res, next) {
    if (err && err instanceof errors.DolphinError) {
        //because this is last of custom error handlers and this error not handled before then send 500
        res.status(500).end();
        console.log('Error');
        console.log(err.stack);
        if (err.cause) {
            console.log('Cause');
            console.log(err.cause.stack);
        }
    } else {
        next(err);
    }
};
