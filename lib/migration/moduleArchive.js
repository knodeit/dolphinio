'use strict';
var path = require('path');
var _ = require('lodash');
var AdmZip = require('adm-zip');
var Q = require('q');

ModuleArchive.resultFileKeys = {
    MODELS: 'models.json',
    FILES: 'files/',
    OPTIONS: 'options.json'
};


/**
 * Container for module content
 * @constructor
 * @param {Buffer} [zipBuffer]
 */
function ModuleArchive(zipBuffer) {
    if (zipBuffer && zipBuffer.length) {
        //existent zip
        this._zip = new AdmZip(zipBuffer);
    } else {
        //create new zip
        this._zip = new AdmZip();
        this._zip.addFile(ModuleArchive.resultFileKeys.FILES, new Buffer(0));
    }

}

ModuleArchive.prototype.addFile = function (fileSrcPath) {
    var target = path.dirname(path.normalize(ModuleArchive.resultFileKeys.FILES + fileSrcPath));
    this._zip.addLocalFile(fileSrcPath, target);
};

ModuleArchive.prototype.addFolder = function (folderSrcPath) {
    var target = path.normalize(ModuleArchive.resultFileKeys.FILES + folderSrcPath);
    this._zip.addLocalFolder(folderSrcPath, target);
};

/**
 *
 * @return {[{filePath: string, fileContent: Buffer}]}
 */
ModuleArchive.prototype.getFiles = function () {
    var fileEntries = this._getFilesEntries();

    return _.map(fileEntries, function (entry) {
        if (entry) {
            //sync operation
            return {
                'filePath': _normalizeFilesEntryName(entry.entryName),
                'fileContent': entry.getData()
            };
        }
    }, this);
};

function _normalizeFilesEntryName(entryName) {
    var len = ModuleArchive.resultFileKeys.FILES.length;
    return entryName.substr(len);
}

ModuleArchive.prototype._getFilesEntries = function () {
    var filesFolderEntry = this._zip.getEntry(ModuleArchive.resultFileKeys.FILES);

    if (filesFolderEntry && filesFolderEntry.isDirectory) {
        var list = [],
            name = filesFolderEntry.entryName,
            len = name.length;

        this._zip.getEntries().forEach(function (zipEntry) {
            if (zipEntry !== filesFolderEntry) {
                if (zipEntry.entryName.substr(0, len) === name) {
                    list.push(zipEntry);
                }
            }
        });
        return list;
    }

    return [];
};


/**
 *
 * @return {string}
 */
ModuleArchive.prototype.getModelsDump = function () {
    //todo: change to promise like?
    return this._zip.readAsText(ModuleArchive.resultFileKeys.MODELS);
};

ModuleArchive.prototype.addModelsDump = function (modelsContent) {
    this._zip.addFile(ModuleArchive.resultFileKeys.MODELS, modelsContent);
};

ModuleArchive.prototype.addOptionsFile = function (optionsContent) {
    this._zip.addFile(ModuleArchive.resultFileKeys.OPTIONS, optionsContent);
};

ModuleArchive.prototype.getOptionsFile = function () {
    return this._zip.readAsText(ModuleArchive.resultFileKeys.OPTIONS);
};


ModuleArchive.prototype.toBuffer = function () {
    var defer = Q.defer();
    this._zip.toBuffer(defer.resolve, function (errorString) {
        defer.reject(new Error(errorString));
    });

    return defer.promise;
};


module.exports.ModuleArchive = ModuleArchive;