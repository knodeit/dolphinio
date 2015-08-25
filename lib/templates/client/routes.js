'use strict';

angular.module('dolphin.__pkgName__').config(['$stateProvider',
    function ($stateProvider) {
        $stateProvider
            //public
            .state('front.__pkgName__', {
                url: '/__name__',
                templateUrl: '__pkgName__/views/index.html',
                controller: 'Front__class__Controller',
            })
            //dashboard
            .state('dashboard.__pkgName__', {
                url: '/__name__',
                templateUrl: '__pkgName__/views/dashboard/index.html',
                controller: 'Dashboard__class__Controller',
                ncyBreadcrumb: {
                    label: '__class__'
                },
                pageSettings: {
                    h1: '__class__'
                },
                resolve: {
                    canRead: function ($q, Acl__class__Service) {
                        if (Acl__class__Service.canRead('dashboard')) {
                            return true;
                        } else {
                            return $q.reject('403');
                        }
                    },
                    testAdminAccess: function (__class__Service) {
                        return __class__Service.testAdminAccess();
                    }
                }
            })
        ;
    }
]);
