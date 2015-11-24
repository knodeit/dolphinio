'use strict';

/**
 * Module dependencies.
 */

module.exports = function (database) {
    var Schema = database.connection.Schema;
    var PackageSchema = new Schema({
        name: String,
        settings: {},
        updated: {
            type: Date,
            default: Date.now
        }
    },{collection: 'kn_packages'});
    database.connection.model('Package', PackageSchema);
};
