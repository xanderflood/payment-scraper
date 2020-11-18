const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const csv = require('csv');
const { createReadStream } = require('fs');
const { Writable } = require('stream');

const Logger = require('node-json-logger');
const logger = new Logger();

class LoadCatsCommand extends Command {
  async run() {
    const {flags, args} = this.parse(LoadCatsCommand)

    var input = process.stdin
    if (args.inputFile != '-') {
      input = createReadStream(args.inputFile);
    }

    const db = new Database(flags.postgresConnection, flags.development);

    var parser = csv.parse();

    var transformer = csv.transform({ parallel: 1 }, function(row) {
      return {
        name: row[0],
        slug: row[1],
      };
    });
    var upserter = new Writable({
      objectMode: true,
      async write(record, _, next) {
        try {
          await db.saveCat(record);
          next();
        } catch (e) {
          next(e);
        }
      },
    });

    input.
      pipe(parser).
      pipe(transformer).
      pipe(upserter).
      on('close', () => console.log("done")).
      on('error', (e) => logger.error("upsert failed:", e.message));
  }
}

LoadCatsCommand.description = `Start the category loader
`

LoadCatsCommand.args = [
  {name: "inputFile", required: true},
]

LoadCatsCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = LoadCatsCommand
