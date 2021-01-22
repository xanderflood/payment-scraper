const { Router } = require('express');
const bodyParser = require('body-parser');
const Logger = require('node-json-logger');
const { DateTime } = require('luxon');
const { errString, statsdPath } = require('../../utils');

const logger = new Logger();

class TransactionServer {
  constructor(database, processor, rollupper) {
    this.database = database;
    this.processor = processor;
    this.rollupper = rollupper;

    this.router = new Router();
    this.router.use(bodyParser.json());

    this.router.get(
      '/categories',
      statsdPath('transaction_categories'),
      this.getCategories.bind(this),
    );
    this.router.get(
      '/unprocessed',
      statsdPath('transaction_unprocessed'),
      this.getUnprocessed.bind(this),
    );
    this.router.post(
      '/categories',
      statsdPath('transaction_categories'),
      this.createCategory.bind(this),
    );
    this.router.post(
      '/categorize',
      statsdPath('transaction_categorize'),
      this.categorizeTransaction.bind(this),
    );
    this.router.post(
      '/process',
      statsdPath('transaction_process'),
      this.process.bind(this),
    );
    this.router.post(
      '/rollups',
      statsdPath('transaction_rollups'),
      this.buildRecentRollups.bind(this),
    );
    this.router.get(
      '/rollups/recent',
      statsdPath('transaction_rollups_recent'),
      this.getRecentRollups.bind(this),
    );
  }

  async getCategories(request, response) {
    let cats;
    try {
      cats = await this.database.getCategories();
    } catch (error) {
      logger.error(
        'error fetching categories - responding with 500',
        errString(error),
      );
      response.status(500).json({ error: errString(error) });
      return;
    }

    response.json({ data: cats });
  }

  async getUnprocessed(request, response) {
    let trs;
    try {
      trs = await this.database.getUnprocessedTransactions();
    } catch (error) {
      logger.error(
        'error fetching unprocessed transactions - responding with 500',
        error,
      );
      response.status(500).json({ error: errString(error) });
      return;
    }

    response.json({ data: trs });
  }

  async createCategory(request, response) {
    if (
      typeof request.body.slug !== 'string' ||
      !request.body.slug.length ||
      typeof request.body.name !== 'string' ||
      !request.body.name.length
    ) {
      response
        .status(400)
        .json({ error: "fields 'slug' and 'name' are required" });
      return;
    }

    let cat;
    try {
      cat = await this.database.addCategory({
        slug: request.body.slug,
        name: request.body.name,
      });
    } catch (error) {
      logger.error('error saving category - responding with 500', error);
      response.status(500).json({ error: errString(error) });
      return;
    }

    response.json(cat);
  }

  async categorizeTransaction(request, response) {
    if (
      typeof request.body.trShortId !== 'string' ||
      !request.body.trShortId.length ||
      ((typeof request.body.catSlug !== 'string' ||
        !request.body.catSlug.length) &&
        typeof request.body.isTransfer !== 'boolean')
    ) {
      response.status(400).json({
        error:
          "you must provide 'trShortId' and one of 'catSlug' or 'isTransfer'",
      });
      return;
    }
    if (!!request.body.notes && typeof request.body.notes !== 'string') {
      response
        .status(400)
        .json({ error: "if provided, field 'notes' must be a string" });
      return;
    }

    if (request.body.isTransfer) {
      try {
        await this.database.markAsTransfer(request.body.trShortId);
      } catch (error) {
        logger.error(
          'error categorizing transaction - responding with 500',
          error,
        );
        response.status(500).json({ error: errString(error) });
        return;
      }
    } else {
      try {
        await this.database.categorizeTransaction(
          request.body.trShortId,
          request.body.catSlug,
          request.body.notes,
        );
      } catch (error) {
        logger.error(
          'error categorizing transaction - responding with 500',
          error,
        );
        response.status(500).json({ error: errString(error) });
        return;
      }
    }

    response.json({ message: 'success' });
  }

  async process(request, response) {
    try {
      await this.processor.initialize();
    } catch (error) {
      logger.error(
        `failed initializing processor - responding with 500`,
        errString(error),
      );
      response.status(500).json({ error: errString(error) });
      return;
    }

    try {
      await this.processor.processTransactions();
    } catch (error) {
      logger.error(
        `failed processing transactions - responding with 500`,
        errString(error),
      );
      response.status(500).json({ error: errString(error) });
      return;
    }

    response.json({ status: 200, message: 'success' });
  }

  async getRecentRollups(request, response) {
    const endDate = DateTime.local();
    const startDate = endDate.minus({ years: 1 });

    let rollups;
    try {
      rollups = await this.database.getRollupsForPeriod(
        startDate.toJSDate(),
        endDate.toJSDate(),
      );
    } catch (error) {
      logger.error(
        'error getting rollups - responding with 500',
        errString(error),
      );
      response.status(500).json({ error: errString(error) });
      return;
    }

    response.json({ status: 200, message: 'success', result: rollups });
  }

  async buildRecentRollups(request, response) {
    try {
      await this.rollupper.rollupRecentMonths();
    } catch (error) {
      logger.error(
        'error building rollups - responding with 500',
        errString(error),
      );
      response.status(500).json({ error: errString(error) });
      return;
    }

    response.json({ status: 200, message: 'success' });
  }
}

module.exports = { TransactionServer };
