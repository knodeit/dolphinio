'use strict';
var util = require('util');

/**
 * Dolphin root error. All new errors must be extend this.
 * @constructor
 * @param {*} [msg]
 * @param {*} [id]
 * @param  {Error} [cause] Previous error
 */
function DolphinError(msg, id, cause) {
    Error.apply(this, arguments);
    if (cause && cause instanceof Error) {
        this.cause = cause;
    }
    this.name = 'DolphinError';
}

util.inherits(DolphinError, Error);

module.exports = {
    DolphinError: DolphinError
};

