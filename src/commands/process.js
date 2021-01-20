const oclif = require('@oclif/command');
const Logger = require('node-json-logger');
const { Database } = require('../database');
const { Processor } = require('../processor');

const logger = new Logger();

class ProcessCommand extends oclif.Command {
  async run() {
    const { flags } = this.parse(ProcessCommand);

    const db = new Database(flags.development);
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
    }
  }
}

ProcessCommand.description = `Start the new transaction processor
`;

ProcessCommand.flags = {
  development: oclif.flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
  }),
};

module.exports = ProcessCommand;
