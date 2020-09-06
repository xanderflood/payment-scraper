const { Client } = require('pg');

const Logger = require('node-json-logger');
const logger = new Logger({ level: 'error'});

class UnrecognizedEmailError extends Error {}

const protonmail = require('./protonmail');
const bot = require('./bot');

const interval = 300000 // 5 minutes
protonmail.startLoop(interval);

bot.start();
