'use strict';

/**
 * Module dependencies.
 */

module.exports = function (database) {
    var Schema = database.Schema;
    var AclLabelSchema = new Schema({
        module: {
            type: String,
            default: ''
        },
        moduleName: {
            type: String,
            default: ''
        },
        entityName: {
            type: String,
            default: ''
        },
        labels: {
            type: Array
        }
    });

    AclLabelSchema.index({module: 1, name: 1}, {unique: 1});
    database.connection.model('AclLabel', AclLabelSchema);
};
