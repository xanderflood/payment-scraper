const { Transform } = require('stream');

const Logger = require('node-json-logger');
const logger = new Logger();

class RecordNotFoundError extends Error {
  constructor(type, id) {
    super(`Could not find record of type \`${type}\` with id \`${id}\``)

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
		this.models = require('../../db/models');
	}

	async getCategories() {
		return await this.models.Category.findAll();
	}
	async getUnprocessedTransactions() {
		return await this.models.Transaction.findAll({ where: { isProcessed: false }, });
	}
	async addCategory(attrs) {
		return await this.models.Category.create(attrs);
	}
	async categorizeTransaction(trShortId, catSlug, notes="") {
		// allow full UUIDs as well
		trShortId = trShortId.slice(0, 5);
		catSlug = catSlug.slice(0, 5);

		var cats = await this.models.Category.findAll({ where: { slug: catSlug } });
		if (cats.length < 1) throw new RecordNotFoundError("category", catSlug);
		const catId = cats[0].id;

		var transactions = await this.models.Transaction.update(
			{	isProcessed: true,
				categoryId: catId,
				notes: notes,
			},
			{ where: { shortId: trShortId } },
		);
		if (transactions.length < 1) throw new RecordNotFoundError("transaction", trShortId);

		return transactions[0];
	}
	async getTransactionBySourceSystemId(sourceSystem, sourceSystemId) {
		var identifiers = { sourceSystem: sourceSystem, sourceSystemId: sourceSystemId }
		return await this.models.Transaction.findAll({ where: identifiers, });
	}
	async createTransaction(attrs) {
		var whitelistedFields = (({sourceSystem, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}) =>
			({sourceSystem, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}))(attrs);

		try {
			return await this.models.Transaction.create(attrs);
		} catch(e) {
			if (e.name == 'SequelizeUniqueConstraintError') {
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
			var cats = await this.models.Category.findAll({ where: { slug: update.catSlug } });
			if (cats.length < 1) throw new RecordNotFoundError("category", update.catSlug);
			catId = cats[0].id;
		}

		var whitelistedFields = (({categoryId, isTransfer, isRefunded, isPossibleDuplicate, systemNotes}) =>
			({categoryId, isTransfer, isRefunded, isPossibleDuplicate, systemNotes}))(update);

		var transactions = await this.models.Transaction.update(
			{	isProcessed: true,
				categoryId: catId,
				...whitelistedFields
			},
			{ where: { id: trId } },
		);
		if (transactions.length < 1) throw new RecordNotFoundError("transaction", trShortId);

		return transactions[0];
	}

	async upsertSyncedTransaction(attrs) {
		var whitelistedFields = (({sourceSystem, syncedAccountId, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}) =>
			({sourceSystem, syncedAccountId, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}))(attrs);

		return await this.models.Transaction.upsert(attrs);
	}

	async saveRule(params) {
		var whitelistedFields = (({field, type, string, number, isTransfer, meta}) =>
			({field, type, string, number, isTransfer, meta}))(params);

		if (params.catSlug) {
			var cats = await this.models.Category.findAll({ where: { slug: params.catSlug } });
			if (cats.length < 1) throw new RecordNotFoundError("category", params.catSlug);

			whitelistedFields.categoryId = cats[0].id;
		}

		return await this.models.CategoryRule.create(whitelistedFields);
	}

	async saveCat(params) {
		var whitelistedFields = (({name, slug}) =>
			({name, slug}))(params);

		return await this.models.Category.create(whitelistedFields);
	}

	async saveSyncedAccount(params) {
		var whitelistedFields = (({id, sourceSystem, sourceSystemId, sourceSystemMeta, sourceSystemAuth}) =>
			({id, sourceSystem, sourceSystemId, sourceSystemMeta, sourceSystemAuth}))(params);

		return await this.models.SyncedAccount.upsert(whitelistedFields);
	}

	async getSyncedAccount(sourceSystem, sourceSystemId) {
		var identifiers = { sourceSystem: sourceSystem, sourceSystemId: sourceSystemId }
		return await this.models.SyncedAccount.findOne({ where: identifiers });
	}

	async deleteSourceSystemTransaction(sourceSystem, sourceSystemId) {
		return await this.models.Transaction.destroy(
			{ where: {
				sourceSystem: sourceSystem,
				sourceSystemId: sourceSystemId,
			} }
		)
	}

	async getRules() {
		return await this.models.CategoryRule.findAll();
	}
}

module.exports = { Database, RecordNotFoundError }
