'use strict';
var dolphinio = require('../lib/dolphin');
var Module = dolphinio.Module;
var expect = require('chai').expect;

describe('APP_CONFIG ', function () {
    it('can be aggregated from all registered modules',
        function () {

            var module1 = new Module('module1');

            var settings1 = {'settings1': 'value1'};
            module1.register(function () {
                module1.angularAppConfigFetcher = function () {
                    return settings1;
                };
                return module1;
            });

            var module2 = new Module('module2');

            var settings2 = {'settings1': 'value1'};
            module2.register(function () {
                module2.angularAppConfigFetcher = function () {
                    return settings2;
                };
                return module2;
            });
            dolphinio.modules[module1.name] = {};
            dolphinio.modules[module2.name] = {};

            var settings = dolphinio.aggregateAngularAppConfigConstantValue();
            expect(settings).to.have.property(module1.name).that.deep.equals(settings1);
            expect(settings).to.have.property(module2.name).that.deep.equals(settings2);
        });
});

