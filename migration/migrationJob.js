'use strict';

/**
 *
  * @constructor
 */
function MigrationJob() {
    this._progress = 0;
    this._resultPromise = null;
    this._status = MigrationJob.statuses.WAIT;
    this._startedAt = new Date();
}

MigrationJob.statuses = {
    WAIT: 'wait',
    IN_PROGRESS: 'inProgress',
    FAILED: 'failed',
    SUCCESS: 'success'
};



MigrationJob.prototype.updateProgress = function (value) {
    //todo: add validation
    this._progress = value;
};

MigrationJob.prototype.getStartedAt = function () {
    return this._startedAt;
};


MigrationJob.prototype.getProgress = function () {
    return this._progress;
};


MigrationJob.prototype.setStatus = function (status) {
    this._status = status;
};

MigrationJob.prototype.getStatus = function () {
    return this._status;
};


MigrationJob.prototype.setResultPromise = function (promise) {
    this._resultPromise = promise;
};

MigrationJob.prototype.getResultPromise = function () {
    return this._resultPromise;
};

module.exports.MigrationJob = MigrationJob;





