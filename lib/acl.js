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
        require('../models/acl')(database);
        require('../models/aclLabel')(database);
        require('../models/aclRole')(database);
    }

    this.matrix = null;
    //load own acl
    glob.sync(this.module.source + '/acl/*').forEach(function (file) {
        $this.matrix = require(file)();

        //load acl
        if ($this.matrix.routers) {
            $this.saveRoles($this.matrix.routers);
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
        _loadLabel($this.module.name, $this.matrix.label, item, $this.database);
    });
};

function _loadLabel(module, moduleName, item, database) {
    var AclLabel = database.connection.model('AclLabel');
    AclLabel.count({module: module, entityName: item.name, 'auditing.deleted': false}).exec(function (err, count) {
        if (count > 0) {
            return;
        }
        var row = new AclLabel({
            module: module,
            moduleName: moduleName,
            entityName: item.name,
            labels: item.labels
        })
        row.save();
    });
}

Acl.prototype.saveRoles = function (routers) {
    if (!util.isArray(routers)) {
        routers = [routers];
    }

    for (var i in routers) {
        var router = routers[i];
        var roles = router.roles;

        for (var j in roles) {
            if (typeof roles[j] === 'string') {
                saveRole(roles[j], roles[j], this.database);
            } else {
                saveRole(roles[j].name, roles[j].role, this.database);
            }
        }
    }
};

function saveRole(name, role, database) {
    var AclRole = database.connection.model('AclRole');

    var row = {
        name: name,
        role: role,
        registrationRole: false,
        'auditing.deleted':false,
        'auditing.canbedeleted': false
    };
    AclRole.update({role: role}, {$setOnInsert: row}, {upsert: true}, function (err, numAffected) {
        if (err) {
            console.error('saveRole', err);
        }
    });
}

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
                if (typeof role === 'object') {
                    role = role.role;
                }
                funcs.push(this.createIfExists(role, router.allows[k].entity, router.allows[k].permissions, router.allows[k].disabled, router.allows[k].canbedeleted));
            }
        }
    }
    Q.all(funcs).then(function () {
        deferred.resolve();
    });
    return deferred.promise;
};

Acl.prototype.createIfExists = function (role, entity, permissions, disabled, canbedeleted) {
    var $this = this;
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    Acl.count({role: role, entity: entity}).exec(function (err, count) {
        if (count > 0) {
            return deferred.resolve();
        }

        $this.allow(role, entity, permissions, disabled, canbedeleted).then(function () {
            console.log(chalk.green('Acl installing role:'), chalk.yellow(role), chalk.green('for entity:'), chalk.yellow(entity));
            deferred.resolve();
        });
    });
    return deferred.promise;
}

Acl.prototype.allow = function (role, entity, permissions, disabled, canbedeleted) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    var row = new Acl({
        module: this.module.name,
        role: role,
        entity: entity,
        permissions: util.isArray(permissions) ? permissions : [permissions],
        disabled: util.isArray(disabled) ? disabled : [disabled],
        'auditing.canbedeleted': typeof canbedeleted == 'undefined' ? false : canbedeleted
    });
    row.save(function () {
        deferred.resolve();
    });
    return deferred.promise;
};

Acl.prototype.getAllow = function (entity) {
    var deferred = Q.defer();
    var Acl = this.database.connection.model('Acl');
    var query = {
        'auditing.deleted': false
    };
    if (entity) {
        query.entity = entity;
    }
    Acl.find(query).exec(function (err, rows) {
        deferred.resolve(rows);
    });
    return deferred.promise;
};

Acl.prototype.getRolesByEntity = function (entity) {
    var deferred = Q.defer();
    var $this = this;
    $this.getAllow(entity).then(function (rows) {
        var roles = [];
        for (var i in rows) {
            roles.push(rows[i].role);
        }
        deferred.resolve(roles);
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

            $this.isDisabled(entity, function (isDisabled) {
                if (isDisabled) {
                    return res.status(404).send('Package disabled');
                }

                //allow
                next();
            });
        });
    }
};

function _checkAccessByEntity($this, entity, user, method) {
    var deferred = Q.defer();

    if (!entity) {
        return Q.resolve(true);
    }

    $this.isDisabled(entity, function (isDisabled) {
        if (isDisabled) {
            return deferred.resolve(false);
        }

        $this.getAllow(entity).then(function (rows) {
            var isAllow = false;
            if (!user) {
                user = {
                    roles: []
                };
            }
            var roles = user.roles.slice();
            if (user.roles.length > 0) {
                roles.push('authenticated');
            } else {
                roles.push('guest');
            }

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

            return deferred.resolve(isAllow);
        });
    });
    return deferred.promise;
}

Acl.prototype.canReadEntity = function (entity, user) {
    return _checkAccessByEntity(this, entity, user, 'get');
};

Acl.prototype.canCreateEntity = function (entity, user) {
    return _checkAccessByEntity(this, entity, user, 'post');
};

Acl.prototype.canUpdateEntity = function (entity, user) {
    return _checkAccessByEntity(this, entity, user, 'put');
};

Acl.prototype.canDeleteEntity = function (entity, user) {
    return _checkAccessByEntity(this, entity, user, 'delete');
};

Acl.prototype.isDisabled = function (entity, callback) {
    var $this = this;
    var Acl = $this.database.connection.model('Acl');
    var Package = $this.database.connection.model('Package');
    Acl.findOne({entity: entity}, {module: 1}).exec(function (err, rowAcl) {
        if (!rowAcl) {
            return callback(true);
        }
        Package.findOne({name: rowAcl.module}).exec(function (err, row) {
            if (!row) {
                return callback(false);
            }

            callback(row.settings.disabled);
        });
    });
};

module.exports = Acl;