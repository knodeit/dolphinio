'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/**
 * __class__Test Schema
 */
var __class__TestSchema = new Schema({
    name: {
        type: String,
        trim: true
    }
});

mongoose.model('__class__Test', __class__TestSchema);
