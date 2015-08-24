'use strict';

angular.module('dolphin.__pkgName__').factory('Acl__class__Service', ['AclService',
    function (AclService) {
        return {
            can: function (action) {
                return AclService.can('__pkgName___' + action);
            }
        };
    }
]);
