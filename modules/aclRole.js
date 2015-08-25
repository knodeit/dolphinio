'use strict';

/**
 * Module dependencies.
 */

module.exports = function (database) {
    var Schema = database.Schema;
    var AclRoleSchema = new Schema({
        name: {
            type: String,
            default: ''
        },
        role: {
            type: String,
            default: ''
        },
        registrationRole: {
            type: Boolean,
            default: false
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

    AclRoleSchema.index({role: 1}, {unique: 1});
    var AclRole = database.connection.model('AclRole', AclRoleSchema);

    //init
    AclRole.count({}).exec(function (err, count) {
        if (count > 0) {
            return;
        }

        var rows = [
            {
                name: 'Administrator',
                role: 'admin',
                'auditing.canbedeleted': false
            },
            {
                name: 'User',
                role: 'user',
                registrationRole: true,
                'auditing.canbedeleted': false
            },
            {
                name: 'Authenticated',
                role: 'authenticated',
                'auditing.canbedeleted': false
            }
        ];

        for (var i in rows) {
            var row = new AclRole(rows[i]);
            row.save();
        }
    });
};
