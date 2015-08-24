'use strict';

angular.module('dolphin.__pkgName__').controller('__class__Controller', ['$scope', 'Global', 'Acl__class__Service', '__class__Service',
    function ($scope, Global, Acl__class__Service, __class__) {
        $scope.global = Global;
        $scope.package = {
            name: '__pkgName__'
        };
    }
]);
