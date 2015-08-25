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
        },
        auditing: {
            createdAt: {type: Date, default: Date.now},
            createdBy: {type: Schema.ObjectId, ref: 'User'},
            lastUpdateAt: {type: Date, default: Date.now},
            lastUpdateBy: {type: Schema.ObjectId, ref: 'User'},
            deleted: {type: Boolean, default: false}
        }
    });
    database.connection.model('Package', PackageSchema);
};
