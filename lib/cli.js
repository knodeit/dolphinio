'use strict';

var fs = require('fs'),
    path = require('path'),
    npm = require('npm'),
    shell = require('shelljs'),
    chalk = require('chalk'),
    request = require('request'),
    querystring = require('querystring'),
    cliVersion = require('../package').version,
    prompt = require('prompt');

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
    var packages = path.join(process.cwd(), source);
    npm.load({
        loglevel: 'error'
    }, function (err, npm) {
        fs.readdir(packages, function (err, files) {
            if (err && 'ENOENT' !== err.code) throw Error(err);

            if (!files || !files.length) return;
            console.log(chalk.green('Auto installing package dependencies'));

            files.forEach(function (file) {
                var pkgPath = path.join(packages, file);

                loadPackageJson(path.join(pkgPath, 'package.json'), function (err, data) {
                    if (err) return;

                    npm.commands.install(pkgPath, [pkgPath], function (err) {
                        if (err) {
                            console.log(chalk.red('Error: npm install failed'));
                            return console.error(err);
                        } else {
                            console.log(chalk.green('    Dependencies installed for package ' + file));
                        }

                        console.log(chalk.green('    Installing Bower dependencies'));
                        require('bower').commands.install([pkgPath], {save: true}).on('error', function (err) {
                            console.log(chalk.red(err));
                        });
                    });
                });
            });
        });
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
            if (shell.test('-d', './packages/custom/' + module)) {
                ensureEmpty('./packages/' + name, options.force, function () {
                    require('./scaffold.js').packages(name, options);
                });
            } else {
                console.log(chalk.yellow('   The module already exist'));
            }
        }
    });
};

exports.postinstall = function () {
    requiresRoot(function () {
        console.log(chalk.green('Installing Bower dependencies'));
        require('bower').commands.install().on('error', function (err) {
            console.log(chalk.red(err));
        }).on('end', function () {
            packagesNpmInstall('packages/custom');
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
