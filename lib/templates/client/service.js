'use strict';

angular.module('dolphin.__pkgName__').factory('__class__Service', ['$q', '$http',
    function ($q, $http) {
        return {
            testAdminAccess: function () {
                var deferred = $q.defer();
                $http.get('/__pkgName__/dashboard/admin').success(function (res) {
                    deferred.resolve(res);
                }).error(function (err) {
                    deferred.reject(err);
                });
                return deferred.promise;
            }
        };
    }
]);
