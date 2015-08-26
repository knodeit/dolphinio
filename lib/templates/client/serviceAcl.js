'use strict';

angular.module('dolphin.__pkgName__').factory('Acl__class__Service', ['AclService',
    function (AclService) {
        return {
            canRead: function (action) {
                return AclService.can('__pkgName___' + action + '_view');
            },
            canCreate: function (action) {
                return AclService.can('__pkgName___' + action + '_create');
            },
            canEdit: function (action) {
                return AclService.can('__pkgName___' + action + '_edit');
            },
            canDelete: function (action) {
                return AclService.can('__pkgName___' + action + '_delete');
            }
        };
    }
]);
