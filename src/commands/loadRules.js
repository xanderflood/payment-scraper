const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const csv = require('csv');
const { createReadStream } = require('fs');
const { Writable } = require('stream');

const Logger = require('node-json-logger');
const logger = new Logger();

class LoadRulesCommand extends Command {
  async run() {
    const {flags, args} = this.parse(LoadRulesCommand)

    var input = process.stdin
    if (args.inputFile != '-') {
      input = createReadStream(args.inputFile);
    }

    const db = new Database(flags.postgresConnection, flags.development);

    var parser = csv.parse();

    var transformer = csv.transform({ parallel: 1 }, function(row) {
      return {
        type:       row[0],
        field:      row[1],
        catSlug:    row[2],
        string:     row[0] == "regex" ? row[3] : null,
        number:     row[0] == "numeric" ? parseFloat(row[3]) : null,
        isTransfer: row[4] == "true",
        meta:       row[5],
      };
    });
    var upserter = new Writable({
      objectMode: true,
      async write(record, _, next) {
        try {
          await db.saveRule(record);
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

LoadRulesCommand.description = `Start the rule loader
`

LoadRulesCommand.args = [
  {name: "inputFile", required: true},
]

LoadRulesCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = LoadRulesCommand
