var nconf = require('nconf');

nconf.argv()
  .env()
  .file('defaults', __dirname + '/test_config.json');

module.exports = nconf;
