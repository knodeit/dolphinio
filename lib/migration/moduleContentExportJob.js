'use strict';
var _ = require('lodash');
var Buffer = require('buffer').Buffer;
var fs = require('fs');
var Q = require('q');
var path = require('path');
var util = require('util');

var ModuleArchive = require('./moduleArchive').ModuleArchive;

var MigrationJob = require('./migrationJob').MigrationJob;

/**
 *
 * @param moduleName
 * @param mongooseModels array of mongoose model instances
 * @param files array with paths to files for save
 * @constructor
 */
function ModuleContentExportJob(moduleName, mongooseModels, files) {
    MigrationJob.call(this);
    //todo: get from module config?
    this._moduleName = moduleName;
    this._mongooseModels = mongooseModels || [];
    this._files = files || [];
    this._moduleArchive = new ModuleArchive();
}

util.inherits(ModuleContentExportJob, MigrationJob);

ModuleContentExportJob.prototype.exportModels = function () {
    var modelFetchPromises = _.map(this._mongooseModels, this.fetchModelDocuments, this);
    var _self = this;
    return Q.all(modelFetchPromises)
        .then(function (arrayOfModels) {
            //convert to json and then to string or buffer
            return JSON.stringify(arrayOfModels);
        })
        .then(function (modelsContentBuffer) {
            _self._moduleArchive.addModelsDump(modelsContentBuffer);
        });
};

ModuleContentExportJob.prototype.fetchModelDocuments = function (model) {
    var defer = Q.defer();
    model.find({'auditing.deleted': false}, function (err, documents) {
        if (err) {
            return defer.reject(err);
        }
        var result = {modelName: model.modelName, content: documents};
        return defer.resolve(result);
    });

    return defer.promise;
};


function _toFilePathStatWithPromise(filePath) {
    var defer = Q.defer();

    fs.stat(path.normalize(filePath), function (err, stat) {
        if (err) {
            return defer.reject(err);
        }

        defer.resolve({srcPath: filePath, stat: stat});
    });

    return defer.promise;
}

ModuleContentExportJob.prototype.exportFiles = function () {
    if (!this._files || !this._files.length) {
        return null;
    }
    var _archive = this._moduleArchive;
    return Q.all(_.map(this._files, _toFilePathStatWithPromise))
        .then(function (statPairs) {
            _.each(statPairs, function (statPair) {
                if (statPair.stat.isFile()) {
                    _archive.addFile(statPair.srcPath);
                } else if (statPair.stat.isDirectory()) {
                    _archive.addFolder(statPair.srcPath);
                }
            });
            return true;
        });
};

ModuleContentExportJob.prototype.runExport = function (exportOptions) {
    //export documents from mongo
    var _self = this;
    _self.updateProgress(0);

    var resultPromise = Q.all([this.exportModels(), this.exportFiles()])
        .then(function () {
            _self._moduleArchive.addOptionsFile(new Buffer(JSON.stringify(exportOptions || {})));

            _self.updateProgress(100);
            _self.setStatus(MigrationJob.statuses.SUCCESS);
        })
        .then(this._moduleArchive.toBuffer.bind(this._moduleArchive))
        .then(function (resultZipBuffer) {
            return {module: _self._moduleName, buffer: resultZipBuffer};
        })
        .catch(function (err) {
            console.error(err);
            _self.updateProgress(100);
            _self.setStatus(MigrationJob.statuses.FAILED);
            throw err;
        });

    this.setResultPromise(resultPromise);
    //todo: add catch if need
};

module.exports.ModuleContentExportJob = ModuleContentExportJob;
