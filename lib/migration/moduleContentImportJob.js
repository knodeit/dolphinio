'use strict';

var util = require('util');

var fs = require('fs');
var path = require('path');
var Q = require('q');
var _ = require('lodash');
var mkdirp = require('mkdirp');


var MigrationJob = require('./migrationJob').MigrationJob;
var ModuleArchive = require('./moduleArchive').ModuleArchive;

var modelsImporter = require('./modelsImporter');

/**
 *
 * @constructor
 */
function ModuleContentImportJob() {
    //fixme: change to dolphin config 'root' key
    this.filesRootFolder = process.cwd();
}

util.inherits(ModuleContentImportJob, MigrationJob);


ModuleContentImportJob.prototype.runImport = function (moduleZipBuffer, importOptions) {
    if (!moduleZipBuffer) {
        return null;
    }
    var _self = this;
    _self.updateProgress(0);


    var options = _.pick(importOptions || {}, ['needOverride']);

    var zip = new ModuleArchive(moduleZipBuffer);

    var resultPromise = Q.all([this._importFiles(zip, options), this._importModels(zip, options)])
        .then(function () {
            _self.updateProgress(100);
            _self.setStatus(MigrationJob.statuses.SUCCESS);
        })
        .catch(function (err) {
            console.error(err);
            _self.updateProgress(100);
            _self.setStatus(MigrationJob.statuses.FAILED);
            throw err;
        });


    this.setResultPromise(resultPromise);
    return resultPromise;
};

/**
 *
 * @param {ModuleArchive} moduleArchive
 * @return {Promise}
 * @private
 */
ModuleContentImportJob.prototype._importFiles = function (moduleArchive, options) {
    var files = moduleArchive.getFiles();

    var writeFilePromises = _.map(files, function (file) {
        return this._writeFileContent(file.filePath, file.fileContent, options);
    }, this);

    return Q.all(writeFilePromises);
};
/**
 *
 * @param {string} filePath
 * @param {Buffer} content
 * @private
 */
ModuleContentImportJob.prototype._writeFileContent = function (filePath, content, options) {
    return Q.Promise(function (resolve, reject) {
        var fullPath = path.normalize(this.filesRootFolder + '/' + filePath);
        if (!options.overrideAll) {
            fs.exists(fullPath, function (exists) {
                if (exists) {
                    return resolve(true);
                }
                //write new file
                writeFile();
            });
        } else {
            //overwrite and write new
            writeFile();
        }

        function writeFile() {
            var dir = path.dirname(fullPath);

            var fileWrittenCB = function (err) {
                if (err) {
                    return reject(err);
                }
                resolve(true);
            };

            var makeDirCB = function (err) {
                if (err) {
                    return reject(err);
                }

                fs.writeFile(fullPath, content, fileWrittenCB);
            };

            mkdirp(dir, makeDirCB);
        }

    }.bind(this));
};

/**
 *
 * @param {ModuleArchive} moduleArchive
 * @param options
 * @return {*}
 * @private
 */
ModuleContentImportJob.prototype._importModels = function (moduleArchive, options) {
    //todo: get import options

    return Q
        .try(function () {
            return JSON.parse(moduleArchive.getModelsDump());
        })
        .then(function (modelsInfo) {
            return modelsImporter.importModels(modelsInfo, options);
        });
};

module.exports.ModuleContentImportJob = ModuleContentImportJob;