/**
 * Created by Vadim on 19.08.2015.
 */
'use strict';
var util = require('util');
var glob = require('glob');
var Q = require('q');
var chalk = require('chalk');

function Acl(module, database) {
    var $this = this;
    this.module = module;
    this.database = database;

    if (!database.connection.models.Acl) {
        require('../modules/acl')(database);
        require('../modules/aclLabel')(database);
    }

    this.matrix = null;
    //load own acl
    glob.sync(this.module.source + '/acl/*').forEach(function (file) {
        $this.matrix = require(file)();

        //load acl
        if ($this.matrix.routers) {
            $this.init($this.matrix.routers);
        }
    });

    this.loadLabels();
}

Acl.prototype.loadLabels = function () {
    var $this = this;
    var AclLabel = $this.database.connection.model('AclLabel');
    if (!$this.matrix) {
        return;
    }

    $this.matrix.labels.forEach(function (item) {
        AclLabel.count({module: $this.module.name, entityName: item.name}).exec(function (err, count) {
            if (count > 0) {
                return;
            }
            var row = new AclLabel({
                module: $this.module.name,
                moduleName: $this.matrix.label,
                entityName: item.name,
                labels: item.labels
            })
            row.save();
        });
    });
};

Acl.prototype.init = function (routers) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');

    if (!util.isArray(routers)) {
        routers = [routers];
    }

    var funcs = [];
    for (var i in routers) {
        var router = routers[i];
        var roles = router.roles;
        if (!util.isArray(roles)) {
            roles = [roles];
        }

        for (var j in roles) {
            var role = roles[j];

            for (var k in router.allows) {
                funcs.push(this.createIfExists(role, router.allows[k].entity, router.allows[k].permissions));
            }
        }
    }
    Q.all(funcs).then(function () {
        deferred.resolve();
    });
    return deferred.promise;
};

Acl.prototype.createIfExists = function (role, entity, permissions) {
    var $this = this;
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    Acl.count({role: role, entity: entity}).exec(function (err, count) {
        if (count > 0) {
            return deferred.resolve();
        }

        $this.allow(role, entity, permissions).then(function () {
            console.log(chalk.green('Acl installing role:'), chalk.yellow(role), chalk.green('for entity:'), chalk.yellow(entity));
            deferred.resolve();
        });
    });
    return deferred.promise;
}

Acl.prototype.allow = function (role, entity, permissions) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    var row = new Acl({
        module: this.module.name,
        role: role,
        entity: entity,
        permissions: util.isArray(permissions) ? permissions : [permissions]
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
            var roles = req.user.roles.slice();
            var isAllow = false;

            roles.push('authenticated');
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

            $this.isDisabled(function (isDisabled) {
                if (isDisabled) {
                    return res.status(404).send('Package disabled');
                }

                //allow
                next();
            });
        });
    }
};

Acl.prototype.checkAccessMenu = function (user, entity) {
    var deferred = Q.defer();

    if (!entity) {
        return Q.resolve(true);
    }

    var $this = this;
    $this.getAllow(entity).then(function (rows) {
        var method = 'get';
        var roles = user.roles.slice();
        var isAllow = false;

        roles.push('authenticated');
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
            return deferred.resolve(false);
        }

        $this.isDisabled(function (isDisabled) {
            //invert
            return deferred.resolve(!isDisabled);
        });
    });
    return deferred.promise;
};

Acl.prototype.isDisabled = function (callback) {
    this.module.settings(function (err, row) {
        if (!row) {
            return callback(false);
        }
        callback(row.settings.disabled);
    });
};


module.exports = Acl;