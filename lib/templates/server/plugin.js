'use strict';

module.exports = function () {
    return {
        model: '', // name of mongoose model, if empty then will not apply
        plugin: function (schema, options) {
            schema.add({
                test: {type: String, default: ''}
            });

            schema.methods.testMethod = function () {
                return this.test;
            };

            schema.statics.staticTestMethod = function () {
                return 'test';
            };
        }
    };
};