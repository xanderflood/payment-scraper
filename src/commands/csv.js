const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const protonmail = require('../protonmail');
const { TransformRecords } = require('../csv')
const csv = require('csv');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream');

const Logger = require('node-json-logger');
const logger = new Logger();

class CSVCommand extends Command {
  async run() {
    const {flags, args} = this.parse(CSVCommand)

    var input = process.stdin
    if (args.inputFile != '-') {
      input = createReadStream(args.inputFile);
    }

    const recordStream = await TransformRecords(input, !flags.postgresConnection);
    if (flags.postgresConnection) {
      const db = new Database(flags.postgresConnection, flags.development);

      await db.initialize();

      recordStream.
        pipe(db.initAsyncUpserter());
    } else {
      var stringifier = csv.stringify({
        header: !flags.batch,
        parallel: 1,
        columns: [
          "source_system",
          "source_system_id",
          "merchant",
          "transaction_date",
          "amount",
          "notes",
        ],
      });

      var output = null;
      if (args.outputFile) {
        output = createWriteStream(args.outputFile);
      } else {
        output = process.stdout;
      }

      var formatter = new Transform({
        objectMode: true,
        async transform(record, _, next) {
          if (record[6] == true) {
            next();
            return
          }

          return next(null, formatOutputRow(record));
        },
      });

      recordStream.
        pipe(formatter).
        pipe(stringifier).
        pipe(output);
    }
  }
}

CSVCommand.description = `Start the protonmail email scanning agent
`

CSVCommand.args = [
  {name: "inputFile", required: true},
  {name: "outputFile"},
]

CSVCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: false}),
  batch: flags.boolean({char: 'b', env: "BATCH", description: 'batch mode', default: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = CSVCommand

function formatOutputRow(record) {
          // cut off the first and last entry
          // then combine the new first entry with the one we cut off
  var formatted = record.slice(1, record.length-1);
  formatted[0] = `${record[0]}|${formatted[0]}`;
  return formatted;
}
