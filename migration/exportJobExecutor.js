'use strict';

var Q = require('q');

var ModuleContentExportJob = require('./moduleContentExportJob').ModuleContentExportJob;

function runNewExport(exportOptions) {
    var module = this;
    var moduleName = module.name;
    var mongooseModels = exportOptions.models || null;
    var files = exportOptions.files || null;

    //read from config file section what we need export and override with incoming if need
    //todo: get models and files what we need export from config
    var exportJob = new ModuleContentExportJob(moduleName, mongooseModels, files);
    exportJob.runExport(exportOptions);
    return Q.resolve(exportJob);
}

module.exports.runNewExport = runNewExport;
