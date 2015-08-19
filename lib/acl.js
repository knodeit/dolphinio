/**
 * Created by Vadim on 19.08.2015.
 */
'use strict';
var util = require('util');
var Q = require('q');

function Acl(database) {
    this.database = database;
    require('../modules/acl')(database);
}

Acl.prototype.init = function (routers) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');

    if (!util.isArray(routers)) {
        routers = [routers];
    }

    var rows = [];
    for (var i in routers) {
        var router = routers[i];
        var roles = router.roles;
        if (!util.isArray(roles)) {
            roles = [roles];
        }

        for (var j in roles) {
            var role = roles[j];

            for (var k in router.allows) {
                rows.push({
                    role: role,
                    entity: router.allows[k].entity,
                    permissions: util.isArray(router.allows[k].permissions) ? router.allows[k].permissions : [router.allows[k].permissions]
                });
            }
        }
    }
    if (rows.length === 0) {
        return;
    }

    Acl.count({}).exec(function (err, count) {
        if (count > 0) {
            return;
        }

        Acl.collection.insert(rows, {continueOnError: true, keepGoing: true, safe: false}, function () {
            deferred.resolve();
        });
    });
    return deferred.promise;
};

Acl.prototype.allow = function (role, entity, permissions) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    var row = new Acl({
        role: role,
        entity: entity,
        permissions: permissions
    });
    row.save(function () {
        deferred.resolve();
    });
    return deferred.promise;
};

Acl.prototype.removeAllow = function (role, entity) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');

    var query = {
        role: role,
        entity: entity
    };

    Acl.remove(query).exec(function () {
        deferred.resolve();
    });
    return deferred.promise;
};

Acl.prototype.replaceAllow = function (role, entity, permissions) {
    var deferred = Q.defer();
    var $this = this;
    $this.removeAllow(role, entity).then(function () {
        $this.allow(role, entity, permissions).then(function () {
            deferred.resolve();
        });
    });
    return deferred.promise;
};


Acl.prototype.getAllow = function (entity) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    var query = {};
    if (entity) {
        query.entity = entity;
    }
    Acl.find(query).exec(function (err, rows) {
        deferred.resolve(rows);
    });
    return deferred.promise;
};

//TODO Test
Acl.prototype.getAngularObj = function () {
    var deferred = Q.defer();
    var $this = this;
    $this.getAllow().then(function (rows) {
        var abilities = {};
        for (var i in rows) {
            var row = rows[i];
            if (!abilities[row.role]) {
                abilities[row.role] = [];
            }

            var actions = row.permissions.map(function (method) {
                return row.entity + '_' + $this.getAction(method);
            });

            abilities[row.role] = abilities[row.role].concat(actions);
        }

        deferred.resolve(abilities);
    });
    return deferred.promise;
};

Acl.prototype.getAction = function (method) {
    var action = null;
    switch (method) {
        case 'get':
        case 'head':
            action = 'view';
            break;

        case 'post':
            action = 'create';
            break;

        case 'put':
        case 'patch':
            action = 'edit';
            break;

        case 'delete':
            action = 'delete';
            break;
    }
    return action;
};

Acl.prototype.checkAccess = function (entity) {
    var $this = this;
    return function (req, res, next) {
        if (!req.user) {
            return res.status(403).send('User is not authorized');
        }

        $this.getAllow(entity).then(function (rows) {
            if (rows.length === 0) {
                return next();
            }

            var method = req.method.toLowerCase();
            var roles = req.user.roles;
            var isAllow = false;

            main:
                for (var i in roles) {
                    var userRole = roles[i];
                    for (var j in rows) {
                        var row = rows[j];
                        if (row.role == userRole && row.permissions.indexOf(method) >= 0) {
                            isAllow = true;
                            break main;
                        }
                    }
                }

            if (!isAllow) {
                return res.status(403).send('Access denied');
            }

            //allow
            next();
        });
    }
};

module.exports = Acl;