const Logger = require('node-json-logger');
const logger = new Logger();

const numericEqualityThreshold = 0.01;

function iMatch(string, regex) {
	return !!((string || "").match(new RegExp(regex), "i"))
}
function roughlyEquals(val, ref) {
	return Math.abs(val - ref) < numericEqualityThreshold;
}

function buildMatcher(rule) {
	switch (rule.type) {
	case "regex":
		return (transaction) => iMatch(transaction[rule.field], rule.string);
	case "numeric":
		return (transaction) => roughlyEquals(rule.number, transaction[rule.field]);
	case "csv_field_regex":
		return (transaction) => transaction.sourceSystem.startsWith("csv|") &&
			(!rule.meta.mode || transaction.sourceSystem == "csv|"+rule.meta.mode) &&
			(!rule.meta.offset || iMatch(transaction.sourceSystemMeta[rule.meta.offset], rule.string)) &&
			(!rule.field || iMatch(transaction[rule.field], rule.string));
	default:
		throw new Error(`unrecognized rule type '${rule.type}'`)
	}
	return (transaction) => {
		var matched = false

		return matched ? rule.categoryId : undefined;
	};
}

function compile(rule) {
	const update = {
		categoryId: rule.categoryId,
		isTransfer: rule.isTransfer,
	};

	const matcher = buildMatcher(rule);
	return (transaction) => matcher(transaction) ? update : undefined;
}

class Processor {
	constructor(database) {
		this.transferIdentifiers = StandardTransferIdentifiers;
		this.database = database;
	}

	async initialize() {
		try {
			this.categorizers = (await this.database.getRules()).map(compile);
		} catch (e) {
			logger.error(`failed fetching categorization rules - rethrowing`, e);
			throw e;
		}
	}
	async processTransactions() {
    try {
      var trs = await this.database.getUnprocessedTransactions();
    } catch (e) {
      logger.error(`failed fetching unprocessed transaction - rethrowing`, e);
      throw e;
    }

    for (var i = trs.length - 1; i >= 0; i--) {
      try {
        let update = await this.processTransaction(trs[i]);

        if (update) {
          await this.database.saveTransactionProcessingResult(trs[i].id, update);
        }
      } catch (e) {
        logger.error(`failed processing transaction - rethrowing`, e);
        throw e;
      }
    }
	}
	async processTransaction(transaction) {
		for (var i = this.categorizers.length - 1; i >= 0; i--) {
			try {
				const update = this.categorizers[i](transaction);
				if (update) return update;
			} catch (error) {
				logger.error("error occurred while evaluating rule - carrying on", e)
			}
		}
	}
}

module.exports = {Processor, compile};
