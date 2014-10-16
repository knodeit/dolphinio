var pkg = require(process.cwd() + '/package.json');
var meanVersion = pkg.mean || pkg.version;
module.exports = require('./lib/dolphin');
