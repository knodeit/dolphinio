'use strict';

angular.module('dolphin.__pkgName__').controller('Dashboard__class__Controller', ['$scope', 'Global', 'Flash', 'Acl__class__Service', '__class__Service', 'testAdminAccess',
    function ($scope, Global, Flash, Acl__class__Service, __class__Service, testAdminAccess) {
        $scope.global = Global;
        $scope.package = {
            name: '__pkgName__'
        };
        $scope.testAdminAccess = testAdminAccess;
    }
]);
