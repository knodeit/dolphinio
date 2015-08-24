'use strict';

// The Package is past automatically as first parameter
module.exports = function (__class__, app, database, passport) {

    app.get('/__name__/example/anyone', function (req, res, next) {
        res.send('Anyone can access this');
    });

    //TODO for admin
    app.get('/__name__/example/admin', function (req, res, next) {
        res.send('Only users with Admin role can access this');
    });
};
