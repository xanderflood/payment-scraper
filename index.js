const { Client } = require('pg');

const Logger = require('node-json-logger');
const logger = new Logger({ level: 'error'});

class UnrecognizedEmailError extends Error {}

const scraper = require('./scraper');
const bot = require('./bot');

// TODO refactor envar config into one place

const interval = 300000 // 5 minutes
scraper.startLoop(interval);

bot.start();
