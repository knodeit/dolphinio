'use strict';

/**
 * Module dependencies.
 */
var Q = require('q');

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
    AclRoleSchema.index({role: 1});

    AclRoleSchema.pre('save', function (next) {
        var $this = this;
        var Acl = database.connection.model('Acl');
        if ($this.auditing.deleted) {
            if (!$this.auditing.canbedeleted || $this.registrationRole) {
                return next(new Error('Row can not be deleted'));
            }
            Acl.update({role: this.role}, {'auditing.deleted': true}, {multi: true}).exec(function () {
                next();
            });
        } else {
            next();
        }
    });

    AclRoleSchema.methods.delete = function () {
        var deferred = Q.defer();
        this.auditing.deleted = true;
        this.save(function (err, row) {
            if (err) {
                return deferred.reject(err);
            }
            deferred.resolve(row);
        })
        return deferred.promise;
    };

    AclRoleSchema.path('role').validate(function (value) {
        var patt = new RegExp('^[a-zA-Z_]{1,20}$', 'i');
        return patt.test(value);
    }, 'Role must be a-z_ from 1 to 20 characters long');

    AclRoleSchema.path('role').validate(function (value, callback) {
        var AclRole = database.connection.model('AclRole');
        AclRole.count({_id: {$ne: this._id}, role: this.role, 'auditing.deleted': false}).exec(function (err, count) {
            callback(count <= 0);
        });
    }, 'The role has already used');


    AclRoleSchema.statics.setRegRole = function (role) {
        var deferred = Q.defer();
        var AclRole = database.connection.model('AclRole');
        AclRole.update({}, {registrationRole: false}, {multi: true}).exec(function () {
            AclRole.findOne({role: role}).exec(function (err, row) {
                if (!row) {
                    return deferred.reject(new Error('Row not found'));
                }
                row.registrationRole = true;
                row.save(function (err, row) {
                    if (!row) {
                        return deferred.reject(new Error('Row was not updated'));
                    }
                    deferred.resolve(row);
                });
            });
        });
        return deferred.promise;
    };

    function validateEntities(entities) {
        var isValid = false;
        for (var i in entities) {
            var entity = entities[i];
            if (entity.permissions.length > 0) {
                isValid = true;
                break;
            }
        }
        return isValid;
    }

    function saveEntity(item) {
        if (item.permissions.length === 0) {
            return Q.resolve();
        }

        var deferred = Q.defer();
        var Acl = database.connection.model('Acl');
        var row = new Acl(item);
        row.save(function (err) {
            deferred.resolve();
        });
        return deferred.promise;
    }

    AclRoleSchema.statics.updateRole = function (params) {
        var deferred = Q.defer();
        var AclRole = database.connection.model('AclRole');
        var Acl = database.connection.model('Acl');
        AclRole.findOne({_id: params.role._id}).exec(function (err, row) {
            if (!row) {
                row = new AclRole();
            }

            if (!params.role.name) {
                row.invalidate('name', 'Name cannot be blank');
            }
            if (!params.entities || !validateEntities(params.entities)) {
                row.invalidate('name', 'Permissions cannot be blank');
            }

            row.name = params.role.name;
            row.role = params.role.role;
            row.auditing.canbedeleted = true;
            row.save(function (err, row) {
                if (err) {
                    return deferred.reject(err);
                }

                Acl.update({role: row.role}, {'auditing.deleted': true}, {multi: true}).exec(function () {
                    var funcs = [];
                    for (var i in params.entities) {
                        params.entities[i].role = row.role;
                        funcs.push(saveEntity(params.entities[i]));
                    }
                    Q.all(funcs).then(function () {
                        deferred.resolve();
                    });
                });
            });
        });
        return deferred.promise;
    };

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
