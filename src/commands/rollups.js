const { Command, flags } = require('@oclif/command')
const { Database } = require('../database');
const { Rollupper } = require('../rollups');
const { DateTime } = require('luxon');

const Logger = require('node-json-logger');
const logger = new Logger();

const LOOKBACK_MONTHS = 12;

class RollupsCommand extends Command {
  async run() {
    const {flags, args} = this.parse(RollupsCommand)

    const db = new Database(flags.development);
    const rollupper = new Rollupper(db);

    var start = DateTime.local();
    start = DateTime.local(start.year, start.month);
    start = start.minus({months: LOOKBACK_MONTHS});
    var end = start.plus({months: 1});
    for (var i = 0; i < 12; i++) {
      try {
        await rollupper.upsertRollupRecordForPeriod(start, end);
      } catch (error) {
        logger.error(`failed building rollup for month starting ${start} - rethrowing`, errString(error));
        throw error;
      }

      // switch to the next month
      start = end;
      end = start.plus({months: 1});
    }
  }
}

RollupsCommand.description = `Start the new transaction processor
`

RollupsCommand.flags = {
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = RollupsCommand
