'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var Q = require('q');
var AdmZip = require('adm-zip');
var _ = require('lodash');

var ModuleContentExportJob = require('../lib/dolphin').migration.ModuleContentExportJob;
var MigrationJob = require('../lib/dolphin').migration.MigrationJob;
var ModuleArchive = require('../lib/dolphin').migration.ModuleArchive;

describe('ModuleContentExportJob', function () {


    it('should export models data', function (done) {
        var models = ['model1', 'model2'];
        var exportJob = new ModuleContentExportJob('testModule', models);
        var jobMock = sinon.stub(exportJob, 'fetchModelDocuments');

        jobMock.withArgs(models[0]).returns(Q.resolve(models[0]));
        jobMock.withArgs(models[1]).returns(Q.resolve(models[1]));

        exportJob.runExport({});
        exportJob.getResultPromise()
            .then(function (resultZipBuffer) {
                expect(resultZipBuffer).to.be.not.empty;
                var archive = new ModuleArchive(resultZipBuffer.buffer);
                var modelsDump = archive.getModelsDump();
                expect(modelsDump).to.eql(JSON.stringify(models));
                done();
            }).catch(done);
    });

    it('should export files', function (done) {
        var files = ['test/assets/moduleExport1.txt', 'test/assets/moduleExport2.txt'];
        var exportJob = new ModuleContentExportJob('testmodule', null, files);

        exportJob.runExport({});
        exportJob.getResultPromise()
            .then(function (resultZipBuffer) {
                expect(resultZipBuffer).to.be.not.empty;
                var archive = new ModuleArchive(resultZipBuffer.buffer);
                return archive.getFiles()
            })
            .then(function (filesEntries) {
                return _.pluck(filesEntries, 'filePath');
            })
            .then(function (filePaths) {
                expect(filePaths).to.eql(files);
            })
            .then(done)
            .catch(function (err) {
                done(err);
            });

    });

    it('should add single files to result zip file');

    it('should add directory to result zip file');

    it('should change progress value');

    it('should be resolved with zip buffer with valid data');
});