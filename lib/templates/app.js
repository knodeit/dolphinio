'use strict';

/*
 * Defining the Package
 *
 *
 */
var Module = require('dolphinio').Module;
var __class__ = new Module('__pkgName__');

var mongoose = require('mongoose');
var Menu = mongoose.model('Menu');

__class__.register(function (app,  database, passport) {

    //We enable routing. By default the Package Object is passed to the routes
    __class__.routes(app,  database, passport);

    __class__.aggregateAsset('css', '__name__.css');
    __class__.aggregateAsset('js', '__name__.js');

    /**
     //include static
     __class__.putJsFiles(['file']);
     __class__.putCssFiles(['file']);

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

    //This is the dashboard menu
    __class__.registerMenu([
        {
            title: '__class__',
            state: 'dashboard.__name__',
            menu: Menu.getMainDashboardMenu(),
            entity: __class__.acl.matrix.entities.dashboard
        }
    ]);

    //This is the public menu that is visible for all visitors
    __class__.registerMenu([
        {
            title: '__class__',
            state: 'front.__name__',
            menu: Menu.getMainFrontMenu(),
            entity:''
        }
    ]);

    return __class__;
});
