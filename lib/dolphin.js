'use strict';

var swig = require('swig'),
    mongoose = require('mongoose'),
    container = require('dependable').container(),
    fs = require('fs'),
    path = require('path'),
    util = require('./util'),
    http = require('http'),
    https = require('https'),
    EventEmitter = require('events').EventEmitter,
    Q = require('q');

var events = new EventEmitter(),
    allMenus = [],
    middleware = {
        before: {},
        after: {}
    };

function Dolphinio() {
    if (this.active) return;
    Dolphinio.Singleton = this;
    this.version = require('../package').version;
    this.events = events;
}
Dolphinio.events = events;

Dolphinio.prototype.serve = function (options, callback) {

    if (this.active) return this;

    // Initializing system variables
    var defaultConfig = util.loadConfig();

    mongoose.set('debug', defaultConfig.mongoose && defaultConfig.mongoose.debug);

    var database = mongoose.connect(defaultConfig.db || '', defaultConfig.dbOptions || {}, function (err) {
        if (err) {
            console.error('Error:', err.message);
            return console.error('**Could not connect to MongoDB. Please ensure mongod is running and restart MEAN app.**');
        }

        // Register database dependency
        Dolphinio.Singleton.register('database', {
            connection: database
        });

        Dolphinio.Singleton.config = new Config(function (err, config) {
            // Bootstrap Models, Dependencies, Routes and the app as an express app
            var app = require('./bootstrap')(options, database);

            // Listen on http.port (or port as fallback for old configs)
            var httpServer = http.createServer(app);
            Dolphinio.Singleton.register('http', httpServer);
            httpServer.listen(config.http ? config.http.port : config.port, config.hostname);

            if (config.https && config.https.port) {
                var httpsOptions = {
                    key: fs.readFileSync(config.https.ssl.key),
                    cert: fs.readFileSync(config.https.ssl.cert)
                };

                var httpsServer = https.createServer(httpsOptions, app);
                Dolphinio.Singleton.register('https', httpsServer);
                httpsServer.listen(config.https.port);
            }

            findModules(function () {
                enableModules();
            });

            Dolphinio.Singleton.aggregate('js', null);

            Dolphinio.Singleton.name = config.app.name;
            Dolphinio.Singleton.app = app;

            Dolphinio.Singleton.menus = new Dolphinio.Singleton.Menus();

            callback(app, config);
        });

        Dolphinio.Singleton.active = true;
        Dolphinio.Singleton.options = options;
    });
};

Dolphinio.prototype.loadConfig = util.loadConfig;

function Config(callback) {

    if (this.config) return this.config;

    loadSettings(this, callback);

    function update(settings, callback) {

        var Package = loadPackageModel();

        if (!Package) return callback(new Error('failed to load data model'));

        Package.findOneAndUpdate({
            name: 'config'
        }, {
            $set: {
                settings: settings,
                updated: new Date()
            }
        }, {
            upsert: true,
            multi: false
        }, function (err, doc) {
            if (err) {
                console.log(err);
                return callback(new Error('Failed to update settings'));
            }

            loadSettings(Dolphinio.Singleton.config);

            return callback(null, doc.settings);
        });
    }

    function loadSettings(Config, callback) {

        var Package = loadPackageModel();

        var defaultConfig = util.loadConfig();

        if (!Package) return defaultConfig;

        Package.findOne({
            name: 'config'
        }, function (err, doc) {

            var original = JSON.flatten(defaultConfig, {
                default: true
            });

            var saved = JSON.flatten(doc ? doc.settings : defaultConfig, {});

            var merged = mergeConfig(original, saved);

            var clean = JSON.unflatten(merged.clean, {});

            var diff = JSON.unflatten(merged.diff, {});

            Config.verbose = {
                clean: clean,
                diff: diff,
                flat: merged
            };

            Config.clean = clean;
            Config.diff = diff;
            Config.flat = merged;
            if (callback) callback(err, clean);
        });
    }

    function mergeConfig(original, saved) {

        var clean = {};

        for (var index in saved) {
            clean[index] = saved[index].value;
            if (original[index]) {
                original[index].value = saved[index].value;
            } else {
                original[index] = {
                    value: saved[index].value
                };
            }

            original[index]['default'] = original[index]['default'] || saved[index]['default'];
        }

        return {
            diff: original,
            clean: clean
        };
    }

    function loadPackageModel() {

        var database = container.get('database');
        if (!database || !database.connection) {
            return null;
        }

        if (!database.connection.models.Package) {
            require('../modules/package')(database);
        }

        return database.connection.model('Package');
    }

    this.update = update;

}

Dolphinio.prototype.status = function () {
    return {
        active: this.active,
        name: this.name
    };
};

Dolphinio.prototype.register = container.register;

Dolphinio.prototype.resolve = container.resolve;

//confusing names, need to be refactored asap
Dolphinio.prototype.load = container.get;

Dolphinio.prototype.moduleEnabled = function (name) {
    return !!this.modules[name];
};

//static property
Dolphinio.modules = [];

//instance property
Dolphinio.prototype.modules = Dolphinio.modules;

Dolphinio.prototype.Menus = function () {
    this.add = function (options) {
        if (!Array.isArray(options)) options = [options];

        options.forEach(function (opt) {
            opt.menu = opt.menu || 'main';
            opt.roles = opt.roles || ['anonymous'];
            allMenus[opt.menu] = allMenus[opt.menu] || [];
            allMenus[opt.menu].push(opt);
        });
        return Dolphinio.Singleton.menus;
    };

    this.get = function (options) {
        var allowed = [];
        options = options || {};
        options.menu = options.menu || 'main';
        options.roles = options.roles || ['anonymous'];
        options.defaultMenu = options.defaultMenu || [];

        var items = options.defaultMenu.concat(allMenus[options.menu] || []);
        items.forEach(function (item) {

            var hasRole = false;
            options.roles.forEach(function (role) {
                if (role === 'admin' || item.roles.indexOf('anonymous') !== -1 || item.roles.indexOf(role) !== -1) {
                    hasRole = true;
                }
            });

            if (hasRole) {
                allowed.push(item);
            }
        });
        return allowed;
    };
};

function Module(name) {
    this.name = lowerCaseFirstLetter(name);
    this.menus = Dolphinio.Singleton.menus;
    this.config = Dolphinio.Singleton.config;

    // bootstrap models
    util.walk(modulePath(this.name, 'server'), 'model', null, require);

}

Module.prototype.render = function (view, options, callback) {
    swig.renderFile(modulePath(this.name, '/server/views/' + view + '.html'), options, callback);
};

Module.prototype.setDefaultTemplate = function (template) {
    Dolphinio.Singleton.template = template;
};

Module.prototype.routes = function () {
    var args = Array.prototype.slice.call(arguments);
    var that = this;
    util.walk(modulePath(this.name, 'server'), 'route', 'middlewares', function (route) {
        require(route).apply(that, [that].concat(args));
    });
};

Module.prototype.register = function (callback) {
    container.register(this.name, callback);
};

Module.prototype.angularDependencies = function (dependencies) {
    this.angularDependencies = dependencies;
    Dolphinio.modules[this.name].angularDependencies = dependencies;
};


function updateSettings(Package, name, settings, callback) {
    Package.findOneAndUpdate({
        name: name
    }, {
        $set: {
            settings: settings,
            updated: new Date()
        }
    }, {
        upsert: true,
        multi: false
    }, function (err, doc) {
        if (err) {
            console.log(err);
            return callback(new Error('Failed to update settings'));
        }
        return callback(null, doc);
    });
}

function getSettings(Package, name, callback) {
    Package.findOne({
        name: name
    }, function (err, doc) {
        if (err) {
            console.log(err);
            return callback(new Error('Failed to retrieve settings'));
        }
        return callback(null, doc);
    });
}

Module.prototype.settings = function () {

    if (!arguments.length) return;

    var database = container.get('database');
    if (!database || !database.connection) {
        return {
            err: true,
            message: 'No database connection'
        };
    }

    if (!database.connection.models.Package) {
        require('../modules/package')(database);
    }

    var Package = database.connection.model('Package');
    if (arguments.length === 2) return updateSettings(Package, this.name, arguments[0], arguments[1]);
    if (arguments.length === 1 && typeof arguments[0] === 'object') return updateSettings(Package, this.name, arguments[0], function () {
    });
    if (arguments.length === 1 && typeof arguments[0] === 'function') return getSettings(Package, this.name, arguments[0]);

};

Dolphinio.prototype.Module = Module;

function lowerCaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function modulePath(name, plus) {
    return path.join(process.cwd(), Dolphinio.modules[name].source, name, plus);
}

function findModules(callback) {

    function searchSource(source) {
        var deferred = Q.defer();
        fs.readdir(path.join(process.cwd(), source), function (err, files) {
            if (err || !files || !files.length) {

                if (err && err.code !== 'ENOENT') {
                    console.log(err);
                } else {
                    return deferred.resolve();
                }
                return deferred.reject(err);
            }

            var promises = [];
            files.forEach(function (file) {
                var fileDefer = Q.defer();
                fs.readFile(path.join(process.cwd(), source, file, 'package.json'), function (fileErr, data) {
                    if (data) {
                        try {
                            var json = JSON.parse(data.toString());
                            if (json.dolphin) {
                                Dolphinio.modules[file] = {
                                    version: json.version,
                                    source: source
                                };
                            }
                        } catch (err) {
                            fileDefer.reject(err);
                        }
                    }
                    fileDefer.resolve();
                });
                promises.push(fileDefer.promise);
            });
            return deferred.resolve(Q.all(promises));
        });
        return deferred.promise;
    }

    Q.all([searchSource('node_modules'), searchSource('packages'), searchSource('packages/core'), searchSource('packages/custom'), searchSource('packages/contrib')]).done(function () {
        events.emit('modulesFound');
        callback();
    }, function (error) {
        console.error('Error loading modules. ' + error);
        callback();
    });
}

function enableModules(callback) {
    var name, remaining = 0;
    for (name in Dolphinio.modules) {
        remaining++;
        require(modulePath(name, 'app.js'));
    }

    for (name in Dolphinio.modules) {
        name = name;
        container.resolve.apply(container, [name]);
        container.get(name);
        remaining--;
        if (!remaining) {
            events.emit('modulesEnabled');
            if (callback) callback(Dolphinio.modules);
        }
    }
}

Dolphinio.prototype.chainware = {

    add: function (event, weight, func) {
        middleware[event].splice(weight, 0, {
            weight: weight,
            func: func
        });
        middleware[event].join();
        middleware[event].sort(function (a, b) {
            if (a.weight < b.weight) {
                a.next = b.func;
            } else {
                b.next = a.func;
            }
            return (a.weight - b.weight);
        });
    },

    before: function (req, res, next) {
        if (!middleware.before.length) return next();
        this.chain('before', 0, req, res, next);
    },

    after: function (req, res, next) {
        if (!middleware.after.length) return next();
        this.chain('after', 0, req, res, next);
    },

    chain: function (operator, index, req, res, next) {
        var args = [req, res,
            function () {
                if (middleware[operator][index + 1]) {
                    this.chain('before', index + 1, req, res, next);
                } else {
                    next();
                }
            }
        ];

        middleware[operator][index].func.apply(this, args);
    }
};

(require('./aggregation'))(Dolphinio);

module.exports = exports = new Dolphinio();
