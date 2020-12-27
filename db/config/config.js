const fs = require('fs');

const config = {
	use_env_variable: 'POSTGRES_CONNECTION_STRING',
	logging: process.env['DB_DEBUG_LOGS'] ? console.log : false,
};

module.exports = {
  development: config,
  production: config,
};
