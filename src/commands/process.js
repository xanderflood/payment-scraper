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
    await processor.initialize();

    var trs;
    try {
      trs = await db.getUnprocessedTransactions();
    } catch (e) {
      logger.error(`failed fetching unprocessed transactions: ${e.message}`, e);
      return;
    }

    for (var i = trs.length - 1; i >= 0; i--) {
      try {
        let update = await processor.processTransaction(trs[i]);
        await db.saveTransactionProcessingResult(trs[i].id, update);
      } catch (e) {
        logger.error(`failed processing transaction: ${e.message}`, e);
        return;
      }
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
