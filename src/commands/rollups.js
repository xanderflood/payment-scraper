const Logger = require('node-json-logger');
const oclif = require('@oclif/command');
const { Database } = require('../database');
const { Rollupper } = require('../rollups');

const logger = new Logger();

class RollupsCommand extends oclif.Command {
  async run() {
    const { flags } = this.parse(RollupsCommand);

    const db = new Database(flags.development);
    const rollupper = new Rollupper(db);

    logger.info('starting rollup job');

    await rollupper.rollupRecentMonths(12);
  }
}

RollupsCommand.description = `Start the new transaction processor
`;

RollupsCommand.flags = {
  development: oclif.flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
  }),
};

module.exports = RollupsCommand;
