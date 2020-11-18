const { Transform } = require('stream');
const { Transaction, Category, CategoryRule } = require('../../db/models');

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
	constructor(connectionURL, development) {
		this._data = [];
		this.development = development;
	}

	async getCategories() {
		return await Category.findAll();
	}
	async getUnprocessedTransactions() {
		return await Transaction.findAll({ where: { isProcessed: false }, });
	}
	async addCategory(attrs) {
		return await Category.create(attrs);
	}
	// async categorizeTransaction(trShortId, catSlug, notes="") {
	// 	// allow full UUIDs as well
	// 	trShortId = trShortId.slice(0, 5);
	// 	catSlug = catSlug.slice(0, 5);

	// 	var cats = await Category.findAll({ where: { slug: catSlug } });
	// 	if (cats.length < 1) throw new RecordNotFoundError("category", catSlug);

	// 	var transactions = await Transaction.update(
	// 		{ categoryId: cats[0].id, notes: notes },
	// 		{ where: { shortId: trShortId } },
	// 	)
	// 	if (transactions.length < 1) throw new RecordNotFoundError("transaction", trShortId);
	// 	return transactions[0];
	// }
	async getTransactionBySourceSystemId(sourceSystem, sourceSystemId) {
		var identifiers = { sourceSystem: sourceSystem, sourceSystemId: sourceSystemId }
		return await Transaction.findAll({ where: identifiers, });
	}
	async createTransaction(attrs) {
		var whitelistedFields = (({sourceSystem, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}) =>
			({sourceSystem, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}))(attrs);

		try {
			return await Transaction.create(attrs);
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
			var cats = await Category.findAll({ zwhere: { slug: update.catSlug } });
			if (cats.length < 1) throw new RecordNotFoundError("category", update.catSlug);
			catId = cats[0].id;
		}

		var whitelistedFields = (({categoryId, isTransfer, isRefunded, isPossibleDuplicate, systemNotes}) =>
			({categoryId, isTransfer, isRefunded, isPossibleDuplicate, systemNotes}))(update);

		var transactions = await Transaction.update(
			{	isProcessed: true,
				categoryId: catId,
				...whitelistedFields
			},
			{ where: { id: trId } },
		);
		if (transactions.length < 1) throw new RecordNotFoundError("transaction", trShortId);

		return transactions[0];
	}

	async saveRule(params) {
		var cats = await Category.findAll({ where: { slug: params.catSlug } });
		if (cats.length < 1) throw new RecordNotFoundError("category", params.catSlug);

		var whitelistedFields = (({field, type, string, number}) =>
			({field, type, string, number}))(params);

		return await CategoryRule.create(
			{	categoryId: cats[0].id,
				...whitelistedFields
			});
	}

	async saveCat(params) {
		var whitelistedFields = (({name, slug}) =>
			({name, slug}))(params);

		return await Category.create(whitelistedFields);
	}

	async getRules() {
		return await CategoryRule.findAll();
	}
}

module.exports = { Database, RecordNotFoundError }
