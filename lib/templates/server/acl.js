'use strict';
/*

Here you define the Access Control Rules (ACL) for your entities
ACL rules are based on CRUD logic so the following options are available

get: this means read access
post: this means create access
put: this means update access
delete: this means delete access

 */
module.exports = function () {
    return {
        label: '__class__',
        package: '__pkgName__',
        get entities() {
            return {
                dashboard: this.package + '_dashboard'
                /*
                if you want to create your own entity for ACL control you add it here as follows:
                 {entity: this.entities.<entityName>, permissions: ['get','post','delete','put'], disabled: ['get'], canbedeleted: false}

                 <entityName>: name of your entity
                 permission array of ACL rules you are allowing
                 disabled:['get'] to avoid administrator from removing it from the dashboard
                 canbedeleted: this row can not be deleted

                 */
            };
        },
        get routers() {
            return [
                {
                    roles: ['admin'],
                    allows: [
                        {entity: this.entities.dashboard, permissions: ['get'], disabled: ['get'], canbedeleted: false}
                    ]
                }
                /*
                If your package requires a specific user role you can simply add it here.
                Make sure to prefix it with your package name to avoid conflicts with other packages

                 {
                 names: ['roleName>'],  eg Driver
                 roles: ['<packageName>_>roleName>'], eg myPackage_Driver
                 allows: [
                 {entity: this.entities.<entityName>, permissions: ['get'], disabled: ['get'], canbedeleted: false}
                 ]
                 }

                 */
            ];
        },
        //Labels are used to display the titles in the user interface for your entities
        get labels() {
            return [
                {
                    name: 'Global',
                    labels: [
                        {
                            key: this.entities.dashboard,
                            value: 'Dashboard page'
                        }
                        /*
                        Adding a title for your own entity
                         {
                         key: this.entities.<entityName>,
                         value: '<Your Entity display name>'
                         }
                         */
                    ]
                }
            ];
        }
    };
};