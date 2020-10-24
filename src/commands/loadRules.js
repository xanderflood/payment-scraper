const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const csv = require('csv');
const { createReadStream } = require('fs');

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
        catSlug: row[0],
        field:   row[1],
        type:    row[2],
        string:  row[2] == "regex" ? row[3] : null,
        number:  row[2] == "numeric" ? parseFloat(row[3]) : null,
      };
    });

    input.
      pipe(parser).
      pipe(transformer).
      pipe(db.initAsyncRuleUpserter());
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
