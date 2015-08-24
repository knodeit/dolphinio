'use strict';

var fs = require('fs'),
    shell = require('shelljs'),
    chalk = require('chalk');

var data = {};

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function camelCase(str) {
    str = str.toLowerCase();
    var parts = str.split(/[\-_ \s]/);
    str = null;
    for (var i = 0; i < parts.length; i++) {
        str = (str ? str + capitaliseFirstLetter(parts[i]) : parts[i]);
    }
    return str;
}

/**
 * echo str > path.
 *
 * @param {String} path
 * @param {String} str
 */
function write(path, str) {
    fs.writeFile(path, str);
    console.log(chalk.cyan('   create:'), path);
}

/**
 * Read template files
 *
 * @param {String} path
 */
function readTemplate(path) {
    var template = fs.readFileSync(__dirname + '/templates/' + path, 'utf8');
    for (var index in data) {
        template = template.split('__' + index + '__').join(data[index]);
    }
    return template;
}

/**
 * Mkdir -p.
 *
 * @param {String} path
 * @param {Function} fn
 */
function mkdir(path, fn) {
    shell.mkdir('-p', path);
    shell.chmod(755, path);
    console.log(chalk.cyan('   create:'), path);
    if (fn) fn();
}

function buildDirectoryStructure() {
    var name = data.name;

    var source = 'packages/custom';
    var path = './' + source + '/' + data.pkgName;
    console.log('Files saved in ' + source + '/' + data.pkgName);

    mkdir(path, function () {
        write(path + '/app.js', readTemplate('app.js'));
        write(path + '/package.json', readTemplate('package.json'));
        write(path + '/bower.json', readTemplate('bower.json'));
        write(path + '/.bowerrc', readTemplate('.bowerrc'));
        write(path + '/README.md', 'README: ' + name);
    });

    mkdir(path + '/server');

    mkdir(path + '/public');
    mkdir(path + '/public/assets');
    mkdir(path + '/public/assets/css', function () {
        write(path + '/public/assets/css/' + name + '.less', readTemplate('assets.less'));
    });
    //mkdir(path + '/public/assets/img', function () {});

    mkdir(path + '/public', function () {
        write(path + '/public/' + name + '.js', readTemplate('client/package.js'));
    });
    mkdir(path + '/public/controllers', function () {
        write(path + '/public/controllers/' + name + '.js', readTemplate('client/controllerFront.js'));
        mkdir(path + '/public/controllers/dashboard', function () {
            write(path + '/public/controllers/dashboard/' + name + '.js', readTemplate('client/controllerDashboard.js'));
        });
    });
    mkdir(path + '/public/directives');
    mkdir(path + '/public/routes', function () {
        write(path + '/public/routes/' + name + '.js', readTemplate('client/routes.js'));
    });
    mkdir(path + '/public/services', function () {
        write(path + '/public/services/' + name + '.js', readTemplate('client/service.js'));
        write(path + '/public/services/acl.js', readTemplate('client/serviceAcl.js'));
    });
    mkdir(path + '/public/views', function () {
        write(path + '/public/views/index.html', readTemplate('client/view.html'));
        mkdir(path + '/public/views/dashboard', function () {
            write(path + '/public/views/dashboard/dashboard.html', readTemplate('client/dashboard.html'));
        });
    });

    mkdir(path + '/server');
    mkdir(path + '/server/config');
    mkdir(path + '/server/controllers');
    mkdir(path + '/server/models');
    mkdir(path + '/server/routes', function () {
        write(path + '/server/routes/' + name + '.js', readTemplate('server/routes.js'));
    });
    mkdir(path + '/server/acl', function () {
        write(path + '/server/acl/index.js', readTemplate('server/acl.js'));
    });
    mkdir(path + '/server/views', function () {
        write(path + '/server/views/index.html', readTemplate('server/view.html'));
    });
}

exports.packages = function (name, options) {

    var pkg = require(process.cwd() + '/package.json');
    var camelName = camelCase(name);

    data = {
        pkgName: name.toLowerCase(),
        name: camelName,
        class: capitaliseFirstLetter(camelName),
        author: (typeof options.author === 'string' ? options.author : 'dolphin scaffold'),
        version: pkg.dolphin || pkg.version
    };

    console.log('Go to /#!/' + data.name + '/example to see your default page');

    buildDirectoryStructure();
};
