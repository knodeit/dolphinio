'use strict';

var Q = require('q');

var ModuleContentImportJob = require('./moduleContentImportJob').ModuleContentImportJob;

function runNewImport(moduleZipBuffer, importOptions) {
    var importJob = new ModuleContentImportJob();
    importJob.runImport(moduleZipBuffer, importOptions);
    return Q.resolve(importJob);
}

module.exports.runNewImport = runNewImport;
