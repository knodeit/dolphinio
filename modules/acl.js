'use strict';

/**
 * Module dependencies.
 */
var Q = require('q');

module.exports = function (database) {
    var Schema = database.Schema;
    var AclSchema = new Schema({
        module: {
            type: String,
            default: ''
        },
        role: {
            type: String,
            default: ''
        },
        entity: {
            type: String,
            default: ''
        },
        permissions: {
            type: Array
        },
        disabled: {
            type: Array
        },
        auditing: {
            createdAt: {type: Date, default: Date.now},
            createdBy: {type: Schema.ObjectId, ref: 'User'},
            lastUpdateAt: {type: Date, default: Date.now},
            lastUpdateBy: {type: Schema.ObjectId, ref: 'User'},
            deleted: {type: Boolean, default: false},
            canbedeleted: {
                type: Boolean,
                default: true
            }
        }
    });

    AclSchema.index({role: 1, entity: 1, 'auditing.deleted': 1}, {unique: 1});

    AclSchema.statics.updateRow = function (_id, permissions) {
        var deferred = Q.defer();
        var Acl = database.connection.model('Acl');
        Acl.findOne({_id: _id}).exec(function (err, row) {
            if (!row) {
                return deferred.reject(new Error('Row not found'));
            }

            row.permissions = permissions;
            row.save(function (err, row) {
                if (err) {
                    console.error(err);
                    return deferred.reject(new Error('Mongo error'));
                }

                deferred.resolve(row);
            });
        });
        return deferred.promise;
    };
    database.connection.model('Acl', AclSchema);
};
