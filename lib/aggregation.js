'use strict';

var fs = require('fs'),
    request = require('request'),
    _ = require('lodash'),
    uglify = require('uglify-js'),
    crypto = require('crypto'),
    path = require('path');

var aggregated = {
    header: {
        js: {
            data: null,
            weights: []
        },
        css: {
            data: null,
            weights: []
        }
    },
    footer: {
        js: {
            data: null,
            weights: []
        },
        css: {
            data: null,
            weights: []
        }
    }
};

function sortAggregateAssetsByWeight() {
    for (var region in aggregated) {
        for (var ext in aggregated[region]) {
            sortByWeight(region, ext);
        }
    }
}

function sortByWeight(group, ext) {
    var weights = aggregated[group][ext].weights;
    var temp = [];

    for (var file in weights) {
        temp.push({
            data: weights[file].data,
            weight: weights[file].weight
        });
    }
    aggregated[group][ext].data = _.map(_.sortBy(temp, 'weight'), function (value) {
        return value.data;
    }).join('\n');
}

function Aggregator(options, libs, debug) {
    this.options = options;
    this.libs = libs;
    this.debug = debug;
}

Aggregator.prototype.addInlineCode = function (ext, data) {
    var md5 = crypto.createHash('md5');
    md5.update(data);
    var hash = md5.digest('hex');
    this.pushAggregatedData(ext, hash, data);
};

Aggregator.prototype.processFileOfFile = function (ext, filepath, fileErr, data) {
    if (!data) {
        this.readFiles(ext, filepath);
    } else {
        var filename = filepath.split(process.cwd())[1];
        this.pushAggregatedData(ext, filename, data);
    }
};

Aggregator.prototype.processDirOfFile = function (ext, filepath, err, files) {
    if (files) return this.readFiles(ext, filepath);
    if (path.extname(filepath) !== '.' + ext) return;
    fs.readFile(filepath, this.processFileOfFile.bind(this, ext, filepath));
};

Aggregator.prototype.readFile = function (ext, filepath) {
    fs.readdir(filepath, this.processDirOfFile.bind(this, ext, filepath));
};

Aggregator.prototype.processFileOfDirOfFiles = function (ext, filepath, file) {
    if (!this.libs && (file !== 'assets' && file !== 'tests')) {
        this.readFile(ext, path.join(filepath, file));
    }
};

Aggregator.prototype.processDirOfFiles = function (ext, filepath, err, files) {
    if (err) return;
    files.forEach(this.processFileOfDirOfFiles.bind(this, ext, filepath));
};

Aggregator.prototype.readFiles = function (ext, filepath) {
    fs.readdir(filepath, this.processDirOfFiles.bind(this, ext, filepath));
};

Aggregator.prototype.getRemoteCode = function (ext, asset) {
    var self = this;
    request(asset, function (err, res, body) {
        if (!err && res.statusCode === 200) {
            self.addInlineCode(ext, body);
        }
    });
};

Aggregator.prototype.pushAggregatedData = function (ext, filename, data) {
    var group = this.options.group || 'footer',
        weight = this.options.weight || 0;

    if (ext === 'js') {

        var code = this.options.global ? data.toString() + '\n' : '(function(){' + data.toString() + '})();';

        var ugly = uglify.minify(code, {
            fromString: true,
            mangle: false
        });

        aggregated[group][ext].weights[filename] = {
            weight: weight,
            data: !this.debug ? ugly.code : code
        };
    } else {
        group = this.options.group || 'header';

        aggregated[group][ext].weights[filename] = {
            weight: weight,
            data: data.toString()
        };
    }
};

function supportAggregate(Dolphinio) {

    Dolphinio.prototype.aggregated = function (ext, group, callback) {
        // Aggregated Data already exists and is ready
        if (aggregated[group][ext].data) return callback(aggregated[group][ext].data);

        // No aggregated data exists so we will build it
        sortAggregateAssetsByWeight();

        // Returning rebuild data. All from memory so no callback required
        callback(aggregated[group][ext].data);
    };

    /**
     * return aggregated object for group
     * @param ext js | css
     * @param group footer | header
     * @param callback {function}
     * @return {*}
     */
    Dolphinio.prototype.aggregatedObj = function (ext, group, callback) {
        // Aggregated Data already exists and is ready
        if (aggregated[group][ext]) return callback(aggregated[group][ext]);

        // No aggregated data exists so we will build it
        sortAggregateAssetsByWeight();

        // Returning rebuild data. All from memory so no callback required
        callback(aggregated[group][ext]);
    };


    // Allows rebuilding aggregated data
    Dolphinio.prototype.rebuildAggregated = function () {
        sortAggregateAssetsByWeight();
    };

    Dolphinio.prototype.Module.prototype.aggregateAsset = function (type, asset, options) {
        options = options || {};
        if (!options.inline && !options.absolute && !options.url) {
            asset = path.join(Dolphinio.modules[this.name].source, this.name, 'public/assets', type, asset);
        }
        Dolphinio.aggregate(type, asset, options, Dolphinio.Singleton.config.clean.debug);
    };

    Dolphinio.onModulesFoundAggregate = function (ext, options, debug) {
        var aggregator = new Aggregator(options, false, debug);
        for (var name in Dolphinio.modules) {
            if(Dolphinio.modules.hasOwnProperty(name)){
                //async find public files
                aggregator.readFiles(ext, path.join(process.cwd(), Dolphinio.modules[name].source, name.toLowerCase(), 'public'));
            }
        }
    };

    Dolphinio.aggregate = function (ext, asset, options, debug) {
        var aggregator;
        options = options || {};
        if (asset) {
            aggregator = new Aggregator(options, true, debug);
            if (options.inline) return aggregator.addInlineCode(ext, asset);
            else if (options.url) return aggregator.getRemoteCode(ext, asset);
            else return aggregator.readFile(ext, path.join(process.cwd(), asset));
        }

        Dolphinio.events.on('modulesFound', Dolphinio.onModulesFoundAggregate.bind(null, ext, options, debug));
    };

    Dolphinio.prototype.aggregate = Dolphinio.aggregate;
}

module.exports = supportAggregate;
