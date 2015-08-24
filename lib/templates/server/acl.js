'use strict';

module.exports = function () {
    return {
        label: '__class__',
        package: '__pkgName__',
        get entities() {
            return {
                dashboard: this.package + '_dashboard'
            };
        },
        get routers() {
            return [
                {
                    roles: ['admin'],
                    allows: [
                        {entity: this.entities.dashboard, permissions: ['get'], disabled: ['get']}
                    ]
                }
            ];
        },
        get labels() {
            return [
                {
                    name: 'Global',
                    labels: [
                        {
                            key: this.entities.dashboard,
                            value: 'Dashboard page'
                        }
                    ]
                }
            ];
        }
    };
};