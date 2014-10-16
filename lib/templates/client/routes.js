'use strict';

angular.module('dolphin.__pkgName__').config(['$stateProvider',
  function($stateProvider) {
    $stateProvider.state('__name__ example page', {
      url: '/__name__/example',
      templateUrl: '__pkgName__/views/index.html'
    });
  }
]);
