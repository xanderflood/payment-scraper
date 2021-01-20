const { Command, flags } = require('@oclif/command');
const { Database } = require('../database');
const { TransactionParser } = require('../csv');
const csv = require('csv');
const { createReadStream, createWriteStream } = require('fs');
const { Transform, Writable } = require('stream');

const Logger = require('node-json-logger');
const logger = new Logger();

class CSVCommand extends Command {
  async run() {
    const { flags, args } = this.parse(CSVCommand);

    var input = process.stdin;
    if (args.inputFile != '-') {
      input = createReadStream(args.inputFile);
    }

    const csvParser = csv.parse({
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const transactionParser = new TransactionParser();

    const records = input.pipe(csvParser).pipe(transactionParser);

    var pipeline;
    if (flags.postgres) {
      const db = new Database(flags.development);
      var upserter = new Writable({
        objectMode: true,
        async write(record, _, next) {
          try {
            await db.createTransaction(record);
            next();
          } catch (e) {
            next(e);
          }
        },
      });

      pipeline = records.pipe(upserter).on('close', db.close);
    } else {
      const stringifier = csv.stringify({
        header: !flags.noOutputHeader,
        parallel: 1,
        columns: [
          'source_system',
          'source_system_id',
          'merchant',
          'transaction_date',
          'amount',
          'notes',
        ],
      });

      const output = args.outputFile
        ? createWriteStream(args.outputFile)
        : process.stdout;

      pipeline = records
        .pipe(outputRowProcessor())
        .pipe(stringifier)
        .pipe(output);
    }

    pipeline.on('error', (e) => logger.error('upsert failed:', e.message));
  }
}

CSVCommand.description = `Ingest or process a CSV file
`;

CSVCommand.args = [
  { name: 'inputFile', required: true },
  { name: 'outputFile' },
];

CSVCommand.flags = {
  postgres: flags.boolean({
    char: 'p',
    env: 'POSTGRES',
    description:
      'Output to postgres instead of file - use ambient configuration',
    default: false,
  }),
  noOutputHeader: flags.boolean({
    char: 'n',
    description: 'omit the header row from output',
    default: true,
  }),
  development: flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
  }),
};

module.exports = CSVCommand;

function outputRowProcessor() {
  return new Transform({
    objectMode: true,
    async transform(object, _, next) {
      if (object.isTransfer) {
        next();
        return;
      }

      return next(null, [
        `${object.sourceSystem}|${object.sourceSystemId || ''}`,
        object.merchant,
        object.transactionDate,
        -object.amount,
        object.notes,
      ]);
    },
  });
}
