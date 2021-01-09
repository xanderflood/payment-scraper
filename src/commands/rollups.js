const Logger = require('node-json-logger');
const { Command, flags } = require('@oclif/command')
const { Database } = require('../database');
const { Rollupper } = require('../rollups');

const logger = new Logger();
const LOOKBACK_MONTHS = 12;

class RollupsCommand extends Command {
  async run() {
    const {flags, args} = this.parse(RollupsCommand)

    const db = new Database(flags.development);
    const rollupper = new Rollupper(db);

    try {
      await rollupper.rollupRecentMonths(LOOKBACK_MONTHS);
    } catch (error) {
      throw error;
    }
  }
}

RollupsCommand.description = `Start the new transaction processor
`

RollupsCommand.flags = {
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = RollupsCommand
