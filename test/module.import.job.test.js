'use strict';
var expect = require('chai').expect;

var AdmZip = require('adm-zip');

var fs = require('fs');
var path = require('path');
var Q = require('q');
var _ = require('lodash');

var ModuleContentExportJob = require('../lib/dolphin').migration.ModuleContentExportJob;
var ModuleContentImportJob = require('../lib/dolphin').migration.ModuleContentImportJob;

describe('ModuleContentImportJob', function () {

    var zipBuffer = null;

    before('read zip to buffer', function (done) {
        fs.readFile(path.normalize(process.cwd() + '/test/assets/export.zip'), function (err, buffer) {
            if (err) {
                return done(err);
            }

            zipBuffer = buffer;
            done();
        });
    });

    //temporary disable this test because we need mock for mongoose
    xit('should import models data', function (done) {

        Q
            .try(function () {
                expect(zipBuffer).to.be.not.empty;
                var zip = new AdmZip(zipBuffer);

                var migrationZipBuffer = zip.getEntry('migration').getData();
                var importJob = new ModuleContentImportJob();
                return importJob.runImport(migrationZipBuffer, {});
            })
            .then(function (res) {
                console.log(res);
                done();
            })
            .catch(function (err) {
                done(err);
            });

    });

    it.only('should import files', function (done) {
        var files = ['test/assets/moduleExport1.txt', 'test/assets/moduleExport2.txt'];
        var exportJob = new ModuleContentExportJob('testmodule', null, files);

        exportJob.runExport({});
        exportJob.getResultPromise()
            .then(function (resultZipBuffer) {
                expect(resultZipBuffer).to.be.not.empty;
                var importJob = new ModuleContentImportJob();
                return importJob.runImport(resultZipBuffer.buffer, {});
            })
            .then(function (res) {
                console.log(done);
                done();
            })
            .catch(function (err) {
                done(err);
            });

    });

    it('should add single files to result zip file');

    it('should add directory to result zip file');

    it('should change progress value');

    it('should be resolved with zip buffer with valid data');
});