const { Router } = require('express');
const Logger = require('node-json-logger');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv');
const { Writable } = require('stream');
const { TransactionParser } = require('../../csv');
const { statsdPath } = require('../../utils');

const logger = new Logger();

class UploadServer {
  constructor(database) {
    this.database = database;
    this.router = new Router();

    // Accepts at most 10 files under the field name 'files'
    // stores them in the OS-default tmp directory.
    const multerMW = multer({ storage: multer.diskStorage({}) }).array(
      'files',
      20,
    );
    this.router.use(multerMW);

    this.router.post(
      '/rules',
      statsdPath('upload_rules'),
      this.buildRulesUploadHandler(),
    );
    this.router.post(
      '/categories',
      statsdPath('upload_categories'),
      this.buildCategoriesUploadHandler(),
    );
    this.router.post(
      '/transactions',
      statsdPath('upload_transactions'),
      this.buildTransactionsUploadHandler(),
    );
  }

  buildRulesUploadHandler() {
    return genericUploadHandler((input, reject) => {
      const csvParser = csv.parse();
      // TODO move this logic all into the csv module
      const transformer = csv.transform({ parallel: 1 }, (row) => ({
        type: row[0],
        field: row[1],
        catSlug: row[2],
        string: row[0] === 'regex' ? row[3] : null,
        number: row[0] === 'numeric' ? parseFloat(row[3]) : null,
        isTransfer: row[4] === 'true',
        meta: row[5],
      }));

      csvParser.on('error', reject);
      transformer.on('error', reject);

      return input.pipe(csvParser).pipe(transformer);
    }, this.database.saveRule.bind(this.database));
  }

  buildCategoriesUploadHandler() {
    return genericUploadHandler((input, reject) => {
      const csvParser = csv.parse();
      // TODO move this logic all into the csv module
      const transformer = csv.transform({ parallel: 1 }, (row) => ({
        name: row[0],
        slug: row[1],
      }));

      csvParser.on('error', reject);
      transformer.on('error', reject);

      return input.pipe(csvParser).pipe(transformer);
    }, this.database.saveCat.bind(this.database));
  }

  buildTransactionsUploadHandler() {
    return genericUploadHandler((input, reject) => {
      const csvParser = csv.parse({
        skip_empty_lines: true,
        relax_column_count: true,
      });
      const transformer = new TransactionParser();

      csvParser.on('error', reject);
      transformer.on('error', reject);

      return input.pipe(csvParser).pipe(transformer);
    }, this.database.createTransaction.bind(this.database));
  }
}

// accepts a hook for wrapping the file stream
function genericUploadHandler(wrap, handle) {
  return async (request, response) => {
    try {
      for (let i = request.files.length - 1; i >= 0; i--) {
        let input;
        try {
          input = fs.createReadStream(request.files[i].path);
        } catch (e) {
          logger.error(
            'failed opening file for ingestion - aborting',
            e.toString(),
          );
          response.status(500).json({});
          return;
        }

        const upserter = new Writable({
          objectMode: true,
          async write(record, _, next) {
            try {
              await handle(record);
              next();
            } catch (e) {
              next(e);
            }
          },
        });

        try {
          await new Promise((resolve, reject) => {
            input.on('error', reject);

            wrap(input, reject)
              .pipe(upserter)
              .on('finish', resolve)
              .on('error', reject);
          });
        } catch (e) {
          logger.error('failed streaming records for ingestion - aborting', e);
          response.status(500).json({});
          return;
        }
      }

      response.json({ status: 200, message: 'success' });
    } catch (e) {
      logger.error('unknown failure, responding with 500', e);
      response.status(500).json({});
    } finally {
      for (let i = request.files.length - 1; i >= 0; i--) {
        try {
          await fs.promises.unlink(request.files[i].path);
        } catch (error) {
          logger.error('failed deleting - carrying on', error);
        }
      }
    }
  };
}

module.exports = { UploadServer };
