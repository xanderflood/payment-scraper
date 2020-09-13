const {Command, flags} = require('@oclif/command')
const { Database } = require ('../database');
const protonmail = require('../protonmail');
var { TransformRecords, modes } = require('../csv')
var csv = require('csv');
var { createReadStream, createWriteStream } = require('fs'); 

const Logger = require('node-json-logger');
const logger = new Logger();

class CSVCommand extends Command {
  async run() {
    const {flags, args} = this.parse(CSVCommand)


    var input = process.stdin
    if (args.inputFile != '-') {
      input = createReadStream(args.inputFile);
    }

    const recordStream = TransformRecords(input, args.mode);

    if (flags.postgresConnection) {
      const database = new Database({ connectionString: flags.postgresConnection });
      const upserter = new Upserter()

      recordStream.
        pipe(upserter);
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
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: false})
}

module.exports = CSVCommand
