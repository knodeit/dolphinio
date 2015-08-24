'use strict';

angular.module('dolphin.__pkgName__').config(['$stateProvider',
    function ($stateProvider) {
        $stateProvider
            //public
            .state('__name__ example page', {
                url: '/__name__/example',
                templateUrl: '__pkgName__/views/index.html',
                controller: '__class__Controller',
            })
            //dashboard
            .state('dashboard.__pkgName__', {
                url: '/__name__',
                templateUrl: '__pkgName__/views/dashboard/dashboard.html',
                controller: 'Dashboard__class__Controller',
                ncyBreadcrumb: {
                    label: '__class__'
                },
                pageSettings: {
                    h1: '__class__'
                },
                resolve: {
                    canRead: function ($q, Acl__class__Service) {
                        if (Acl__class__Service.can('dashboard_view')) {
                            return true;
                        } else {
                            return $q.reject('403');
                        }
                    }
                }
            })
        ;
    }
]);
