const Logger = require('node-json-logger');
const { errString } = require('../utils');
const { DateTime } = require('luxon');

const logger = new Logger();
const DEFAULT_LOOKBACK_MONTHS = 12;

class Rollupper {
	constructor(database) {
		this.database = database;
	}

	async upsertRollupRecordForPeriod(start, end) {
		try {
			var transactions = await this.database.getIntersectingTransactions(start, end);
		} catch (error) {
			logger.error(`failed fetching tranasactions for period - rethrowing`, errString(error));
			throw error;
		}

		var totalsByCategory = {};
		for (var i = transactions.length - 1; i >= 0; i--) {
			const weight = getAmortizationWeight(start, end,
				new DateTime(transactions[i].amortize[0]),
				new DateTime(transactions[i].amortize[1]));

			// TODO make sure uncategorized are also included
			// TODO add a button/endpoint for mark-as-transfer

			const cat = transactions[i].categoryId;
			if (!totalsByCategory[cat]) totalsByCategory[cat] = 0;
			totalsByCategory[cat] += weight * transactions[i].amount;
		}

		try {
			await this.database.saveRollupForPeriod(start.toJSDate(), totalsByCategory);
		} catch (error) {
			logger.error(`failed saving rollups for period - rethrowing`, errString(error));
			throw error;
		}
	}

	async rollupRecentMonths(lookbackMonths) {
		var start = this.startOfThisMonth().minus({months: lookbackMonths || DEFAULT_LOOKBACK_MONTHS});
		var end = start.plus({months: 1});
		for (var i = 0; i < 12; i++) {
			try {
				await this.upsertRollupRecordForPeriod(start, end);
			} catch (error) {
				logger.error(`failed building rollup for month starting ${start} - rethrowing`, errString(error));
				throw error;
			}

			// switch to the next month
			start = end;
			end = start.plus({months: 1});
		}
	}

	startOfThisMonth() {
		var start = DateTime.local();
		return DateTime.local(start.year, start.month);
	}
}

function getAmortizationWeight(periodStart, periodEnd, amortizeStart, amortizeEnd) {
	const intersectionDuration = DateTime.min(periodEnd, amortizeEnd)
		- DateTime.max(periodStart, amortizeStart);
	if (intersectionDuration <= 0) return 0;

	const amortizeDuration = amortizeEnd - amortizeStart;
	return intersectionDuration / amortizeDuration;
}

module.exports = { Rollupper };
