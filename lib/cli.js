'use strict';

var fs = require('fs');
var path = require('path');
var npm = require('npm');
var shell = require('shelljs');
var chalk = require('chalk');
var request = require('request');
var querystring = require('querystring');
var cliVersion = require('../package').version;
var prompt = require('prompt');
var async = require('async');
var Q = require('q');

function Progress() {
    var interval, counter;

    function printMsg() {
        switch (counter) {
            case 0:
                console.log('Use `dolphin --help` from command line for all CLI options');
                break;
            case 1:
                console.log('Be sure to checkout all the docs on http://mean.io');
                break;
            case 2:
                console.log('This may take a little while depending on your connection speed');
                break;
            case 15:
                console.log('Seems a bit slow. Check your internet connection...');
                break;
            default:
                console.log('Still cloning...');
                break;
        }
        counter++;
    }

    return {
        start: function () {
            counter = 0;
            interval = setInterval(printMsg, 3000);
        },
        stop: function () {
            clearInterval(interval);
        }
    };
}
var progress = new Progress();

// From express
function emptyDirectory(path, callback) {
    fs.readdir('./' + path, function (err, files) {
        if (err && 'ENOENT' !== err.code) throw new Error(err);
        callback(!files || !files.length);
    });
}

function ensureEmpty(path, force, callback) {
    emptyDirectory(path, function (empty) {
        if (empty || force) {
            callback();
        } else {
            console.log(chalk.yellow('Destination is not empty:'), path);
        }
    });
}

function loadPackageJson(path, callback) {
    fs.readFile(path, function (err, data) {
        if (err) return callback(err);

        try {
            var pkg = JSON.parse(data.toString());
            pkg.meanVersion = pkg.mean || pkg.version;
            callback(null, pkg);
        } catch (err) {
            return callback(err);
        }
    });
}

function loadPackageJson(path, callback) {
    fs.readFile(path, function (err, data) {
        if (err) return callback(err);

        try {
            var pkg = JSON.parse(data.toString());
            pkg.meanVersion = pkg.mean || pkg.version;
            callback(null, pkg);
        } catch (err) {
            return callback(err);
        }
    });
}

function requiresRoot(callback) {
    loadPackageJson(process.cwd() + '/package.json', function (err, data) {
        if (err || (data.name !== 'dolphin' && !data.mean)) {
            console.log(chalk.yellow('Invalid dolphin app or not in app root'));
        } else {
            callback();
        }
    });
}

function packagesNpmInstall(source) {
    var deferred = Q.defer();
    var packages = path.join(process.cwd(), source);
    npm.load({
        loglevel: 'error'
    }, function (err, npm) {
        fs.readdir(packages, function (err, files) {
            if (err && 'ENOENT' !== err.code) throw Error(err);

            if (!files || !files.length) {
                return deferred.resolve(null);
            }

            var paths = [];
            files.forEach(function (file) {
                var pkgPath = path.join(packages, file);
                paths.push(pkgPath);
                var json = path.join(pkgPath, 'package.json');
                if (!fs.existsSync(json)) {
                    return deferred.resolve(paths);
                }
                loadPackageJson(json, function (err, data) {
                    if (err) {
                        console.log(chalk.red('Error: npm install failed.' + file));
                        console.error(err);
                        return deferred.resolve(paths);
                    }

                    npm.commands.install(pkgPath, [pkgPath], function (err) {
                        if (err) {
                            console.log(chalk.red('Error: npm install failed..'));
                            console.error(err);
                            return deferred.resolve(paths);
                        }

                        console.log(chalk.green('    Dependencies installed for package ' + source + '/' + file));
                        deferred.resolve(paths);
                    });
                });
            });
        });
    });
    return deferred.promise;
}

function bowerInstall(packagePath, callback) {
    console.log(chalk.green('    Installing Bower dependencies in: ' + packagePath));
    if (!fs.existsSync(path.join(packagePath, 'bower.json'))) {
        return callback();
    }

    require('bower').commands.install(undefined, undefined, {cwd: packagePath, interactive: true}).on('error', function (err) {
        if (err) {
            console.log(chalk.red(err));
        }
        callback();
    }).on('end', function () {
        callback();
    });
}

exports.init = function (name, options) {
    if (!shell.which('git')) return console.log(chalk.red('    Prerequisite not installed: git'));

    var source = (options.git ? 'git@github.com:knodeit/dolphin.git' : 'https://github.com/knodeit/dolphin.git');

    // Allow specifying specific repo
    if (options.repo) {
        source = options.repo;
    }

    console.log(chalk.green('Cloning branch: %s into destination folder:'), options.branch, name);

    progress.start();
    source = options.branch + ' ' + source + ' ' + name;
    shell.exec('git clone -b ' + source, function (code, output) {
        progress.stop();
        if (code) return console.log(chalk.red('Error: git clone failed:', output));

        loadPackageJson('./' + name + '/package.json', function (err, data) {
            if (err) {
                console.log(chalk.yellow('Something went wrong.'));
                //fallback code here
                process.exit();
            }

            console.log(chalk.green('Version: %s cloned'), data.meanVersion);
            console.log();

            shell.cd(name);
            shell.exec('git remote rename origin upstream', function (code) {
                if (!code) {
                    console.log('   git remote upstream set');
                    console.log();
                }
            });

            var grunted = shell.which('grunt');

            if (options.quick) {
                npm.load(function (err, npm) {
                    console.log(chalk.green('   installing dependencies...'));
                    console.log();
                    npm.commands.install(function (err) {
                        if (err) {
                            console.log(chalk.red('Error: npm install failed'));
                            return console.error(err);
                        }
                        console.log(chalk.green('   running the dolphin app...'));
                        console.log();
                        if (grunted) {
                            shell.exec('grunt', ['-f']);
                        } else {
                            shell.exec('node server');
                        }
                    });
                });
            } else {
                console.log('   install dependencies:');
                console.log('     $ cd %s && npm install', name);
                console.log();
                console.log('   run the app:');
                console.log('     $', grunted ? 'grunt' : 'node server');
                console.log();
            }
            console.log();
        });
    });
};

exports.pkg = function (name, options) {
    requiresRoot(function () {
        if (options.delete) {
            exports.uninstall(name);
        } else {
            ensureEmpty('./packages/custom/' + name, options.force, function () {
                require('./scaffold.js').packages(name, options);
            });
        }
    });
};

exports.postinstall = function () {
    requiresRoot(function () {
        console.log(chalk.green('Installing Bower dependencies in root folder'));
        require('bower').commands.install().on('error', function (err) {
            console.log(chalk.red(err));
        }).on('end', function () {
            Q.all([packagesNpmInstall('packages'), packagesNpmInstall('packages/custom')]).then(function (results) {
                console.log(chalk.green('Installing Bower dependencies in package folder'));

                var paths = [];
                paths = paths.concat(results[0]);
                paths = paths.concat(results[1]);

                var queue = async.queue(function (path, callback) {
                    bowerInstall(path, callback);
                }, 1);

                for (var i in paths) {
                    if (paths[i]) {
                        queue.push(paths[i]);
                    }
                }
            });
        });
    });
};

exports.uninstall = function (module) {
    requiresRoot(function () {
        console.log(chalk.yellow('Removing module:'), module);
        if (shell.test('-d', './packages/custom/' + module)) {
            shell.rm('-rf', './packages/custom/' + module);
        }
        console.log(chalk.green('   uninstall complete'));
    });
};
