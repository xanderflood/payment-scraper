const { Command, flags } = require('@oclif/command')
const { Database } = require('../database');
const { Processor } = require('../processor');

const Logger = require('node-json-logger');
const logger = new Logger();

class ProcessCommand extends Command {
  async run() {
    const {flags, args} = this.parse(ProcessCommand)

    const db = new Database(flags.postgresConnection, flags.development);
    const processor = new Processor(db);
    try {
      await processor.initialize();
    } catch (e) {
      logger.error(`failed initializing processor - aborting`, e);
      return;
    }

    try {
      await processor.processTransactions();
    } catch (e) {
      logger.error(`failed processing transactions - aborting`, e);
      return;
    }
  }
}

ProcessCommand.description = `Start the new transaction processor
`

ProcessCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: false}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = ProcessCommand
