'use strict';

var testCtrl = require('../controllers/__name__');

// The Package is past automatically as first parameter
module.exports = function (__class__, app, database, passport) {

    app.get('/__name__/dashboard/test/anyone', testCtrl.publicTest);

    app.get('/__name__/dashboard/admin', __class__.acl.checkAccess(__class__.acl.matrix.entities.dashboard), testCtrl.adminTest);

    /*
     //post - create
     app.post('/test/dashboard/test/admin', Test.acl.checkAccess(Test.acl.matrix.dashboard), function (req, res) {
     });

     //put - update
     app.put('/test/dashboard/test/admin', Test.acl.checkAccess(Test.acl.matrix.dashboard), function (req, res) {
     });

     //delete - delete
     app.delete('/test/dashboard/test/admin', Test.acl.checkAccess(Test.acl.matrix.dashboard), function (req, res) {
     });
     */
};
