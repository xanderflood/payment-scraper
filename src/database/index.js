const { Sequelize, Model, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Transform } = require('stream');

class Transaction extends Model {}
class Category extends Model {}

class RecordNotFoundError extends Error {
  constructor(type, id) {
    super(`Could not find record of type \`${type}\` with id \`${id}\``)

    this.type = type;
    this.id = id;
  }
}

class Database {
	constructor(connectionURL, development){
		this._data = [];

		const sequelize = new Sequelize(connectionURL);

		Category.init({
			id: { type: Sequelize.UUID, primaryKey: true },
			name: { type: Sequelize.STRING, unique: true, allowNull: false },
			slug: { type: Sequelize.STRING, unique: true, allowNull: false },
		}, { sequelize, modelName: 'category' });

		Transaction.init({
			id:      { type: Sequelize.UUID, primaryKey: true },
			shortId: { type: Sequelize.STRING, unique: true },

			// scraper metadata
			sourceSystem:     { type: Sequelize.STRING },
			sourceSystemId:   { type: Sequelize.STRING },
			sourceSystemMeta: { type: Sequelize.JSONB },

			// inferred fields
			transactionDate: { type: Sequelize.DATE, allowNull: false },
			institution:     { type: Sequelize.STRING, allowNull: false },
			merchant:        { type: Sequelize.STRING, allowNull: false },
			amountString:    { type: Sequelize.STRING, allowNull: false },
			amount:          { type: Sequelize.DOUBLE, allowNull: false },
			notes:           { type: Sequelize.STRING },

			// manual fields
			isTransfer:          { type: Sequelize.BOOLEAN, default: false, allowNull: false },
			isRefunded:          { type: Sequelize.BOOLEAN, default: false, allowNull: false },
			isPossibleDuplicate: { type: Sequelize.BOOLEAN, default: false, allowNull: false },
			isProcessed:         { type: Sequelize.BOOLEAN, default: false, allowNull: false },
			systemNotes:         { type: Sequelize.STRING },

			categoryId: { type: Sequelize.UUID, references: { model: Category, key: 'id' } },
		}, { sequelize, modelName: 'transaction' });

		Transaction.beforeCreate(async (tr, options) => {
			tr.id = uuidv4();
			tr.shortId = tr.id.slice(0, 5);
		});
	}

	async initialize() {
		await Category.sync({ force: development });
		await Transaction.sync({ force: development });
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
	async categorizeTransaction(trShortId, catSlug, notes="") {
		// allow full UUIDs as well
		trShortId = trShortId.slice(0, 5);
		catSlug = catSlug.slice(0, 5);

		var cats = Category.findAll({ where: { slug: catSlug } });
		if (cats.length < 1) throw new RecordNotFoundError("category", catSlug);

		var transactions = await Transaction.update(
			{ categoryId: cats[0].id, notes: notes },
			{ where: { shortId: trShortId } },
		)
		if (transactions.length < 1) throw new RecordNotFoundError("transaction", trShortId);
		return transactions[0];
	}
	async createTransaction(attrs) {
		var whitelistedFields = (({sourceSystem, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}) =>
			({sourceSystem, sourceSystemId, sourceSystemMeta, transactionDate, institution, merchant, amountString, amount, notes}))(attrs);

		return await Transaction.create(attrs);
	}
	async saveTransactionProcessingResult(trShortId, update) {
		trShortId = trShortId.slice(0, 5);

		var whitelistedFields = (({categoryId, isTransfer, isRefunded, isPossibleDuplicate, systemNotes}) =>
			({categoryId, isTransfer, isRefunded, isPossibleDuplicate, systemNotes}))(update);

		var transactions = await Transaction.update(
			{	isProcessed: true,
				...whitelistedFields
			},
			{ where: { shortId: trShortId } },
		);
		if (transactions.length < 1) throw new RecordNotFoundError("transaction", trShortId);

		return transactions[0];
	}

	initAsyncUpserter() {
		return new Transform({
			objectMode: true,
			async transform(record, _, next) {
				await database.createTransaction(record);
				next(null, record);
			},
		});
	}

	// TODO disable this in dev mode
	// async unProcessAllTransactions() {}
}

module.exports = { Database, RecordNotFoundError }
