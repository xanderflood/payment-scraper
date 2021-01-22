const Logger = require('node-json-logger');

const logger = new Logger();

class RecordNotFoundError extends Error {
  constructor(type, id) {
    super(`Could not find record of type \`${type}\` with id \`${id}\``);

    this.type = type;
    this.id = id;
  }
}

class Database {
  constructor(development) {
    this._data = [];
    this.development = development;

    // NOTE: this is only require'd when a database is instantiated, because
    // requiring the sequelize models will attempt to open a DB connection and
    // fail, due to missing configs.
    this.models = require('../../db/models'); // eslint-disable-line global-require
  }

  async getCategories() {
    return this.models.Category.findAll();
  }

  async getUnprocessedTransactions() {
    return this.models.Transaction.findAll({
      where: { isProcessed: false },
    });
  }

  async addCategory(attrs) {
    return this.models.Category.create(attrs);
  }

  async categorizeTransaction(trSId, catSlug, notes = '') {
    // allow full UUIDs as well
    const trShortId = trShortId.slice(0, 5);

    const cats = await this.models.Category.findAll({
      where: { slug: catSlug },
    });
    if (cats.length < 1) throw new RecordNotFoundError('category', catSlug);
    const catId = cats[0].id;

    const transactions = await this.models.Transaction.update(
      { isProcessed: true, categoryId: catId, notes },
      { where: { shortId: trShortId } },
    );
    if (transactions.length < 1)
      throw new RecordNotFoundError('transaction', trShortId);

    return transactions[0];
  }

  async getTransactionBySourceSystemId(sourceSystem, sourceSystemId) {
    const identifiers = {
      sourceSystem,
      sourceSystemId,
    };
    return this.models.Transaction.findAll({ where: identifiers });
  }

  async createTransaction(attrs) {
    const whitelistedFields = (({
      sourceSystem,
      sourceSystemId,
      sourceSystemMeta,
      transactionDate,
      institution,
      merchant,
      amountString,
      amount,
      notes,
    }) => ({
      sourceSystem,
      sourceSystemId,
      sourceSystemMeta,
      transactionDate,
      institution,
      merchant,
      amountString,
      amount,
      notes,
    }))(attrs);

    try {
      return await this.models.Transaction.create(whitelistedFields);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        logger.info('skipping duplicate source system identifier');
      } else {
        logger.error(e);
      }
      return false;
    }
  }

  async saveTransactionProcessingResult(trId, update) {
    let catId;
    if (update.catSlug) {
      const cats = await this.models.Category.findAll({
        where: { slug: update.catSlug },
      });
      if (cats.length < 1)
        throw new RecordNotFoundError('category', update.catSlug);
      catId = cats[0].id;
    }

    const whitelistedFields = (({
      categoryId,
      isTransfer,
      isRefunded,
      isPossibleDuplicate,
      systemNotes,
    }) => ({
      categoryId,
      isTransfer,
      isRefunded,
      isPossibleDuplicate,
      systemNotes,
    }))(update);

    const transactions = await this.models.Transaction.update(
      { isProcessed: true, categoryId: catId, ...whitelistedFields },
      { where: { id: trId } },
    );
    if (transactions.length < 1)
      throw new RecordNotFoundError('transaction', trId);

    return transactions[0];
  }

  async upsertSyncedTransaction(attrs) {
    const whitelistedFields = (({
      sourceSystem,
      syncedAccountId,
      sourceSystemId,
      sourceSystemMeta,
      transactionDate,
      institution,
      merchant,
      amountString,
      amount,
      notes,
    }) => ({
      sourceSystem,
      syncedAccountId,
      sourceSystemId,
      sourceSystemMeta,
      transactionDate,
      institution,
      merchant,
      amountString,
      amount,
      notes,
    }))(attrs);

    return this.models.Transaction.upsert(whitelistedFields);
  }

  async saveRule(params) {
    const whitelistedFields = (({
      field,
      type,
      string,
      number,
      isTransfer,
      meta,
    }) => ({
      field,
      type,
      string,
      number,
      isTransfer,
      meta,
    }))(params);

    if (params.catSlug) {
      const cats = await this.models.Category.findAll({
        where: { slug: params.catSlug },
      });
      if (cats.length < 1)
        throw new RecordNotFoundError('category', params.catSlug);

      whitelistedFields.categoryId = cats[0].id;
    }

    return this.models.CategoryRule.create(whitelistedFields);
  }

  async saveCat(params) {
    const whitelistedFields = (({ name, slug }) => ({ name, slug }))(params);

    return this.models.Category.create(whitelistedFields);
  }

  async saveSyncedAccount(params) {
    const whitelistedFields = (({
      id,
      sourceSystem,
      sourceSystemId,
      sourceSystemMeta,
      sourceSystemAuth,
    }) => ({
      id,
      sourceSystem,
      sourceSystemId,
      sourceSystemMeta,
      sourceSystemAuth,
    }))(params);

    return this.models.SyncedAccount.upsert(whitelistedFields);
  }

  async getSyncedAccount(sourceSystem, sourceSystemId) {
    const identifiers = {
      sourceSystem,
      sourceSystemId,
    };
    return this.models.SyncedAccount.findOne({ where: identifiers });
  }

  async deleteSourceSystemTransaction(sourceSystem, sourceSystemId) {
    return this.models.Transaction.destroy({
      where: {
        sourceSystem,
        sourceSystemId,
      },
    });
  }

  async getRules() {
    return this.models.CategoryRule.findAll();
  }

  async getIntersectingTransactions(startMoment, endMoment) {
    const start = formatDate(startMoment);
    const end = formatDate(endMoment);

    return (
      await this.models.sequelize.query(`
SELECT * FROM transactions
WHERE (amortize IS NULL
    AND daterange(${start}, ${end}) @> transaction_date::date
  ) OR NOT (daterange(${start}, ${end}) && amortize)
`)
    )[0];
  }

  async saveRollupForPeriod(startMoment, rollup) {
    return this.models.Rollup.upsert({
      monthStart: startMoment,
      rollup,
    });
  }
}

function formatDate(ts) {
  return `'${ts.getFullYear().toString().padStart(4, '0')}-${(ts.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${ts.getDate().toString().padStart(2, '0')}'::date`;
}

module.exports = { Database, RecordNotFoundError };
