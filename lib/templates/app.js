'use strict';

/*
 * Defining the Package
 */
var Module = require('dolphinio').Module;

var __class__ = new Module('__pkgName__');


__class__.register(function (app, auth, database, passport) {

    //We enable routing. By default the Package Object is passed to the routes
    __class__.routes(app, auth, database, passport);

    __class__.aggregateAsset('css', '__name__.css');
    __class__.aggregateAsset('js', '__name__.js');

    /**
     // Another save settings example this time with no callback
     // This writes over the last settings.
     __class__.settings({
        'anotherSettings': 'some value'
    });

     // Get settings. Retrieves latest saved settigns
     __class__.settings(function(err, settings) {
        //you now have the settings object
    });
     */

    return __class__;
});
