'use strict';

exports.publicTest = function(req, res) {
    res.send('Anyone can access this');
};

exports.adminTest = function(req, res) {
    res.send('Only users with Admin role can see this');
};