'use strict';

/**
 * Module dependencies.
 */

module.exports = function (database) {
    var Schema = database.Schema;
    var AclSchema = new Schema({
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
        }
    });

    AclSchema.index({role: 1, entity: 1}, {unique: 1});
    database.connection.model('Acl', AclSchema);
};
