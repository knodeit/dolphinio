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
    Q = require('q'),
    Acl = require('./acl'),
    Promise = require('bluebird');

var events = new EventEmitter(),
    middleware = {
        before: []
    };

/**
 * @class
 * @constructor
 */
function Dolphinio() {
    if (this.active) return;
    Dolphinio.Singleton = this;
    this.version = require('../package').version;
    this.events = events;
}
Dolphinio.events = events;

Dolphinio.prototype.loadConfig = util.loadConfig;

Dolphinio.prototype.serve = function (options, callback) {

    if (this.active) return this;

    // Initializing system variables
    var defaultConfig = util.loadConfig();

    mongoose.set('debug', defaultConfig.mongoose && defaultConfig.mongoose.debug);

    var database = mongoose.connect(defaultConfig.db || '', defaultConfig.dbOptions || {}, function (err) {
        if (err) {
            console.error('Error:', err.message);
            return console.error('[Error] Could not connect to MongoDB. Please ensure mongod is running and restart dolphin application.');
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
            Dolphinio.Singleton.events.on('bootstrapLoaded', function () {
                httpServer.listen(config.http ? config.http.port : config.port, config.hostname);
                callback(app, config);
            });

            if (config.https && config.https.port) {
                var httpsOptions = {
                    key: fs.readFileSync(config.https.ssl.key),
                    cert: fs.readFileSync(config.https.ssl.cert)
                };

                var httpsServer = https.createServer(httpsOptions, app);
                Dolphinio.Singleton.register('https', httpsServer);

                Dolphinio.Singleton.events.on('bootstrapLoaded', function () {
                    httpsServer.listen(config.https.port);
                    callback(app, config);
                });
            }

            //includes all models before inject models
            bootstrapModels();

            findModules(function () {
                enableModules();
            });

            var debug = process.env.NODE_ENV === 'development';

            Dolphinio.Singleton.aggregate('js', null, options, debug);

            Dolphinio.Singleton.app = app;
        });

        Dolphinio.Singleton.active = true;
        Dolphinio.Singleton.options = options;
    });
};

function bootstrapModels() {
    util.preload(process.cwd() + '/packages/**/server', 'model');
}

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
Dolphinio.modules = {};

//static property
Dolphinio.staticAssetsJs = {};
Dolphinio.staticAssetsCss = {};

//instance property
Dolphinio.prototype.modules = Dolphinio.modules;
Dolphinio.prototype.staticAssetsJs = Dolphinio.staticAssetsJs;
Dolphinio.prototype.staticAssetsCss = Dolphinio.staticAssetsCss;

/**
 * Each modules and aggregate angular APP_CONFIG content
 * @return {{}} {moduleName: {}}
 */
Dolphinio.prototype.aggregateAngularAppConfigConstantValue = function () {
    var modules = Dolphinio.modules;
    var appConfig = {};
    var fetchers = [];
    var fetcherNames = [];

    for (var moduleName in  modules) {
        if (modules.hasOwnProperty(moduleName)) {
            var module = container.get(moduleName);

            if (module && isFunction(module.angularAppConfigFetcher)) {
                fetchers.push(module.angularAppConfigFetcher());
                fetcherNames.push(moduleName);
            }
        }
    }

    if (fetchers.length > 0) {
        return Promise.all(fetchers)
            .then(function (configs) {
                for (var i = 0; i < configs.length; i++) {
                    if (configs[i]) {
                        appConfig[fetcherNames[i]] = configs[i];
                    }
                }
                return appConfig;
            });

    }

    return Promise.resolve(appConfig);

};

function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

/*
 Object.keys(Dolphinio.modules).map(function(k) {
 packages.push(Dolphinio.modules[k]);
 return Dolphinio.modules[k]
 */
Dolphinio.prototype.getAllPackages = function () {
    var deferred = Q.defer();
    var database = container.get('database');
    var Package = database.connection.model('Package');
    Package.find({}).exec(function (err, rows) {
        var customPackages = [];
        var corePackages = [];
        Object.keys(Dolphinio.modules).map(function(k){
            var pkg = Dolphinio.modules[k];
            if (pkg.core === true){
                corePackages.push(pkg);
            }
            else{
                //custom package
                var item = {
                    name: pkg.name,
                    core: pkg.core,
                    version:pkg.version,
                    author:pkg.author,
                    documentation:pkg.documentation,
                    description:pkg.description,
                    settings: {}
                };
                for (var i in rows) {
                    if (rows[i].name == pkg.name) {
                        item.settings = rows[i].settings;
                    }
                }
                customPackages.push(item);
            }
        });



        /*
         for (var name in Dolphinio.modules) {
         if (Dolphinio.modules[name].source.indexOf('custom') > -1) {
         var item = {
         name: name,
         settings: {}
         };
         for (var i in rows) {
         if (rows[i].name == name) {
         item.settings = rows[i].settings;
         }
         }
         customPackages.push(item);
         }


         }
         */
        var allPackages = corePackages.concat(customPackages);
        deferred.resolve(allPackages);
    });
    return deferred.promise;
};

Dolphinio.prototype.getCustomPackages = function () {
    var deferred = Q.defer();
    var database = container.get('database');
    var Package = database.connection.model('Package');
    Package.find({}).exec(function (err, rows) {
        var packages = [];
        for (var name in Dolphinio.modules) {
            if (Dolphinio.modules[name].source.indexOf('custom') > -1) {
                var item = {
                    name: name,
                    settings: {}
                };
                for (var i in rows) {
                    if (rows[i].name == name) {
                        item.settings = rows[i].settings;
                    }
                }
                packages.push(item);
            }
        }
        deferred.resolve(packages);
    });
    return deferred.promise;
};

/**
 *
 * @param name new module name
 * @class
 * @constructor
 */
function Module(name) {
    var $this = this;
    this.name = lowerCaseFirstLetter(name);
    this.source = modulePath(this.name, 'server');
    this.config = util.loadConfig(modulePath(this.name, 'server'));
    this.acl = new Acl(this, container.get('database').connection);
    this.container = {};

    util.walk(modulePath(this.name, 'server'), 'preload', '', function (file) {
        var obj = require(file)($this.config);
        if (obj.enabled && obj.name && obj.resolve) {
            $this.putObject(obj.name, obj.resolve());
        }
    });
}

Module.prototype.putObject = function (name, obj) {
    if (this.container[name]) {
        throw new Error('Object already exists')
    }
    this.container[name] = obj;
};

Module.prototype.getObject = function (name) {
    return this.container[name];
};

Module.prototype.render = function (view, options, callback) {
    swig.renderFile(modulePath(this.name, '/server/views/' + view + '.html'), options, callback);
};

Module.prototype.setDefaultTemplate = function (template) {
    Dolphinio.Singleton.template = template;
};

Module.prototype.setDefaultRender = function (link) {
    Dolphinio.Singleton.defaultRender = link;
};

Module.prototype.routes = function () {
    var args = Array.prototype.slice.call(arguments);
    var that = this;
    util.walk(modulePath(this.name, 'server'), 'route', 'middlewares', function (route) {
        require(route).apply(that, [that].concat(args));
    });
};

Module.prototype.getErrorHandlers = function () {
    var arr = [];
    util.walk(modulePath(this.name, 'server'), 'last_handlers', '', function (path) {
        arr.push(path);
    });
    return arr;
};

Module.prototype.register = function (callback) {
    container.register(this.name, callback);
};

Module.prototype.angularDependencies = function (dependencies) {
    this.angularDependencies = dependencies;
    Dolphinio.modules[this.name].angularDependencies = dependencies;
};

Module.prototype.putJsFiles = function (files) {
    for (var i in files) {
        Dolphinio.staticAssetsJs[files[i]] = files[i];
    }
};

Module.prototype.putCssFiles = function (files) {
    for (var i in files) {
        Dolphinio.staticAssetsCss[files[i]] = files[i];
    }
};

/**
 * This is method must be return object (or promise) with settings for angular app that injected as constant APP_CONFIG.
 * Settings object will be accessed by 'moduleName' key
 * @return {{}} default implementation return null
 */
Module.prototype.angularAppConfigFetcher = function () {
    return null;
};

Module.prototype.registerMenu = function (items) {
    for (var i in items) {
        var item = items[i];
        createMenuItem(this.name, item, null);
    }
};

Module.prototype.addItemMenu = function (item) {
    createMenuItem(this.name, item, null);
};

Module.prototype.delItemMenu = function (_id, callback) {
    var database = container.get('database');
    var Menu = database.connection.model('Menu');
    Menu.remove({_id: _id}).exec(callback);
};

function createMenuItem(moduleName, item, parent) {
    if (!item.title || !item.menu || !item.state) {
        return console.error('Bad item in menu');
    }

    var database = container.get('database');
    var Menu = database.connection.model('Menu');
    var query = {
        title: item.title.trim(),
        parent : parent
    };
    var update = {
        module: moduleName,
        title: item.title,
        menu: item.menu,
        state: item.state,
        entity: item.entity || '',
        sort: item.sort || 0,
        params: item.params ? JSON.stringify(item.params) : '{}'
    };
    if (parent) {
        update.parent = parent;
    }
    Menu.findOne(query).exec(function (err, row) {
        if (row) {
            return;
        }
        row = new Menu(update);
        row.save(function (err, row) {
            for (var i in item.items) {
                createMenuItem(moduleName, item.items[i], row._id)
            }
        });
    });
}

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

Module.prototype.setStatus = function (status) {
    var $this = this;
    var database = container.get('database');
    var Package = database.connection.model('Package');
    var deferred = Q.defer();
    Package.findOneAndUpdate({
        name: $this.name
    }, {
        $set: {
            'settings.disabled': !status,
            updated: new Date()
        }
    }, {
        upsert: true,
        multi: false
    }, function (err, doc) {
        if (err) {
            return deferred.reject('Row is not updated');
        }
        deferred.resolve();
    });
    return deferred.promise;
};

Dolphinio.prototype.Module = Module;

function lowerCaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function modulePath(name, plus) {
    if (Dolphinio.modules[name]) {
        return path.join(process.cwd(), Dolphinio.modules[name].source, name, plus);
    }
    return null;
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
                                    name:json.name,
                                    version: json.version,
                                    source: source,
                                    core: json.core  === 'true' ? true : false,
                                    author:json.author,
                                    documentation:json.documentation,
                                    description:json.description
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

    Q.all([searchSource('packages'), searchSource('packages/custom')]).done(function () {
        events.emit('modulesFound');
        callback();
    }, function (error) {
        console.error('Error loading modules. ' + error);
        callback();
    });
}

function enableModules(callback) {
    var remaining = 0;
    for (var notLoadedName in Dolphinio.modules) {
        if (Dolphinio.modules.hasOwnProperty(notLoadedName)) {
            remaining++;
            require(modulePath(notLoadedName, 'app.js'));
        }
    }

    var loadedModuleName;
    for (loadedModuleName in Dolphinio.modules) {
        if (Dolphinio.modules.hasOwnProperty(loadedModuleName)) {
            container.resolve.apply(container, [loadedModuleName]);
            container.get(loadedModuleName); //check dependencies and throw exceptions if something wrong
            remaining--;
            if (!remaining) {
                events.emit('modulesEnabled');
                if (callback) callback(Dolphinio.modules);
            }
        }
    }
}

Dolphinio.prototype.chainware = {
    add: function (func) {
        middleware.before.push(func);
    },
    before: function (req, res, next) {
        if (!middleware.before.length) return next();

        var proms = [];
        for (var i in middleware.before) {
            proms.push(middleware.before[i].apply(this, [req, res]));
        }
        Q.all(proms).then(function () {
            next();
        });
    }
};

(require('./aggregation'))(Dolphinio);
module.exports = exports = new Dolphinio();
