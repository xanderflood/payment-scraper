const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const { TransformRecords } = require('../csv')
const csv = require('csv');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream');

const Logger = require('node-json-logger');
const logger = new Logger();

class PGInitCommand extends Command {
  async run() {
    const {flags, args} = this.parse(PGInitCommand)

    const db = new Database(flags.postgresConnection, flags.development);

    try {
      await db.initialize();
    } catch (e) {
      logger.error(e);
      return;
    }
  }
}

PGInitCommand.description = `Initialize the postgres database
`

PGInitCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: true}),
}

module.exports = PGInitCommand
