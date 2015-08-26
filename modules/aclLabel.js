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
        },
        auditing: {
            createdAt: {type: Date, default: Date.now},
            createdBy: {type: Schema.ObjectId, ref: 'User'},
            lastUpdateAt: {type: Date, default: Date.now},
            lastUpdateBy: {type: Schema.ObjectId, ref: 'User'},
            deleted: {type: Boolean, default: false}
        }
    });

    AclLabelSchema.index({module: 1, name: 1, 'auditing.deleted': 1}, {unique: 1});
    database.connection.model('AclLabel', AclLabelSchema);
};
