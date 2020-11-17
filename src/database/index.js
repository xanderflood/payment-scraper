const { Sequelize, Model, Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Transform } = require('stream');
const crypto = require('crypto');

const Logger = require('node-json-logger');
const logger = new Logger();

const numericEqualityThreshold = 0.01

const unprocessedTransactionsViewQuery = `
CREATE OR replace VIEW unprocessed_transactions AS
	SELECT transaction_date, merchant, amount, notes
		FROM transactions
		WHERE NOT is_processed
		ORDER BY transaction_date DESC;
`;

const monthlyTotalsViewQuery = `
CREATE OR replace VIEW monthly_totals AS
	SELECT EXTRACT(year FROM transaction_date) AS year, EXTRACT(month FROM transaction_date) AS month, cat.name AS cat_name, SUM(tr.amount) AS total
		FROM transactions AS tr
		LEFT JOIN categories AS cat
			ON cat.id = tr.category_id
		GROUP BY EXTRACT(year FROM transaction_date), EXTRACT(month FROM transaction_date), cat.id, cat.name
		ORDER BY EXTRACT(year FROM transaction_date), EXTRACT(month FROM transaction_date), cat.id;
`;

class Transaction extends Model {}
class Category extends Model {}
class CategoryRule extends Model {
	apply(transaction) {
		return this.match(transaction) ? this.categoryId : undefined;
	}

	match(transaction) {
		switch (this.type) {
		case "regex":
			return !!(transaction[this.field].match(new RegExp(this.string), "i"));
		case "numeric":
			return Math.abs(this.number - transaction[this.field]) < numericEqualityThreshold;
		default:
			return false;
		}
	}
}

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
		this.development = development;

		const sequelize = new Sequelize(connectionURL, { logging: false });
		this.sequelize = sequelize;

		Category.init({
			id: { type: Sequelize.UUID, primaryKey: true },
			name: { type: Sequelize.STRING, unique: true, allowNull: false },
			slug: { type: Sequelize.STRING, unique: true, allowNull: false },
		}, { sequelize, modelName: 'category' });

		CategoryRule.init({
			id: { type: Sequelize.UUID, primaryKey: true },
			categoryId: { type: Sequelize.UUID, references: { model: Category, key: 'id' }, field: "category_id" },

			field:  { type: Sequelize.STRING, isIn: [["merchant", "notes", "amount"]] },
			type:   { type: Sequelize.STRING, isIn: [["regex", "numeric"]] },
			string: { type: Sequelize.STRING, allowNull: true },
			number: { type: Sequelize.DOUBLE, allowNull: true },
		}, { sequelize, modelName: 'categoryRule', tableName: "category_rule" });

		Transaction.init({
			id:      { type: Sequelize.UUID, primaryKey: true },
			shortId: { type: Sequelize.STRING, unique: true, field: "short_id" },

			// scraper metadata
			sourceSystem:       { type: Sequelize.STRING, field: "source_system" },
			sourceSystemId:     { type: Sequelize.STRING, field: "source_system_id" },
			sourceSystemMeta:   { type: Sequelize.JSONB, field: "source_system_meta" },
			sourceSystemDigest: { type: Sequelize.STRING, field: "source_system_digest" },

			// inferred fields
			transactionDate: { type: Sequelize.DATE, allowNull: false, field: "transaction_date" },
			institution:     { type: Sequelize.STRING, allowNull: false },
			merchant:        { type: Sequelize.STRING, allowNull: false },
			amountString:    { type: Sequelize.STRING, allowNull: false, field: "amount_string" },
			amount:          { type: Sequelize.DOUBLE, allowNull: false },
			notes:           { type: Sequelize.STRING },

			// manual fields
			isTransfer:          { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false, field: "is_transfer" },
			isRefunded:          { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false, field: "is_refunded" },
			isPossibleDuplicate: { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false, field: "is_possible_duplicate" },
			isProcessed:         { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false, field: "is_processed" },
			systemNotes:         { type: Sequelize.STRING, field: "system_notes" },

			categoryId: { type: Sequelize.UUID, references: { model: Category, key: 'id' }, field: "category_id" },
		}, {
			sequelize,
			modelName: 'transaction',
			indexes: [
				{
					unique: true,
					name: "transaction_source_system",
					fields: ["source_system", "source_system_id", "transaction_date"],
					where: { "source_system_id": { [Op.not]: null } },
				},
			],
		});

		Transaction.beforeCreate(async (tr, options) => {
			tr.id = uuidv4();
			tr.shortId = tr.id.slice(0, 5);

			tr.sourceSystemDigest = crypto.createHash('md5')
				.update(JSON.stringify(tr.sourceSystemMeta))
				.digest("hex");
		});
		Category.beforeCreate(async (tr, options) => {
			tr.id = uuidv4();
		});
		CategoryRule.beforeCreate(async (tr, options) => {
			tr.id = uuidv4();
		});
	}

	async close() {
		await sequelize.close()
	}

	async initialize() {
		try {
			await Category.sync({ alter: true, force: this.development });
		} catch (error) {
			logger.error(error);
			throw error;
		}
		try {
			await Transaction.sync({ alter: true, force: this.development });
		} catch (error) {
			logger.error(error);
			throw error;
		}
		try {
			await CategoryRule.sync({ alter: true, force: this.development });
		} catch (error) {
			logger.error(error);
			throw error;
		}

		try {
			await this.sequelize.query(unprocessedTransactionsViewQuery);
		} catch (error) {
			logger.error(error);
			throw error;
		}

		try {
			await this.sequelize.query(monthlyTotalsViewQuery);
		} catch (error) {
			logger.error(error);
			throw error;
		}
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
