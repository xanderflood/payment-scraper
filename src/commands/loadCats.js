const oclif = require('@oclif/command');
const csv = require('csv');
const { createReadStream } = require('fs');
const { Writable } = require('stream');

const Logger = require('node-json-logger');
const { Database } = require('../database');

const logger = new Logger();

class LoadCatsCommand extends oclif.Command {
  async run() {
    const { flags, args } = this.parse(LoadCatsCommand);

    let input = process.stdin;
    if (args.inputFile !== '-') {
      input = createReadStream(args.inputFile);
    }

    const db = new Database(flags.development);

    const parser = csv.parse();

    const transformer = csv.transform({ parallel: 1 }, (row) => ({
      name: row[0],
      slug: row[1],
    }));
    const upserter = new Writable({
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

    input
      .pipe(parser)
      .pipe(transformer)
      .pipe(upserter)
      .on('close', () => logger.info('done'))
      .on('error', (e) => logger.error('upsert failed:', e.message));
  }
}

LoadCatsCommand.description = `Start the category loader
`;

LoadCatsCommand.args = [{ name: 'inputFile', required: true }];

LoadCatsCommand.flags = {
  development: oclif.flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
  }),
};

module.exports = LoadCatsCommand;
