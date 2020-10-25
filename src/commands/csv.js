const { Command, flags } = require('@oclif/command')
const { Database } = require ('../database');
const { TransactionParser } = require('../csv')
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

    const csvParser = csv.parse({
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const transactionParser = new TransactionParser();

    const records = input
      .pipe(csvParser)
      .pipe(transactionParser);

    if (flags.postgresConnection) {
      const db = new Database(flags.postgresConnection, flags.development);

      records.
        pipe(db.initAsyncTransactionUpserter());
    } else {
      const stringifier = csv.stringify({
        header: !flags.noOutputHeader,
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

      const output = args.outputFile
        ? createWriteStream(args.outputFile)
        : process.stdout;

      records.
        pipe(outputRowProcessor()).
        pipe(stringifier).
        pipe(output);
    }
  }
}

CSVCommand.description = `Ingest or process a CSV file
`

CSVCommand.args = [
  {name: "inputFile", required: true},
  {name: "outputFile"},
]

CSVCommand.flags = {
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: false}),
  noOutputHeader: flags.boolean({char: 'n', description: 'omit the header row from output', default: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = CSVCommand

function outputRowProcessor() {
  return new Transform({
    objectMode: true,
    async transform(object, _, next) {
      if (object.isTransfer) {
        next();
        return
      }

      return next(null, [
        `${object.sourceSystem}|${object.sourceSystemId}`,
        object.merchant,
        object.transactionDate,
        -object.amount,
        object.notes,
      ]);
    },
  });
}
