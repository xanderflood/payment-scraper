const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const protonmail = require('../protonmail');
const { TransformRecords, modes } = require('../csv')
const csv = require('csv');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream-transform');

const Logger = require('node-json-logger');
const logger = new Logger();

class CSVCommand extends Command {
  async run() {
    const {flags, args} = this.parse(CSVCommand)

    var input = process.stdin
    if (args.inputFile != '-') {
      input = createReadStream(args.inputFile);
    }

    const db = new Database(flags.postgresConnection, flags.development);

    const recordStream = TransformRecords(input, args.mode, !flags.postgresConnection);
    if (flags.postgresConnection) {
      await db.initialize();

      recordStream.
        pipe(db.initAsyncUpserter());
    } else {
      var stringifier = csv.stringify({
        header: true,
        parallel: 1,
        columns: [
          "source_system",
          "source_system_id",
          "merchant",
          "transaction_date",
          "amount",
          "notes",
          "transfer",
        ],
      });

      var output = null;
      if (args.outputFile) {
        output = createWriteStream(args.outputFile);
      } else {
        output = process.stdout;
      }

      recordStream.
        pipe(stringifier).
        pipe(output);
    }
  }
}

CSVCommand.description = `Start the protonmail email scanning agent
`

CSVCommand.args = [
  {name: "mode", required: true}, // TODO , options: [ modes ]},
  {name: "inputFile", required: true},
  {name: "outputFile"},
]

CSVCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: false}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = CSVCommand
