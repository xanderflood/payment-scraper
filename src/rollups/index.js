const Logger = require('node-json-logger');
const { errString } = require('../utils')
const logger = new Logger();

class Rollupper {
	constructor(database) {
		this.database = database;
	}

	async upsertRollupRecordForPeriod(startMoment, endMoment) {
		try {
			var transactions = await this.database.getIntersectingTransactions(startMoment, endMoment);
		} catch (error) {
			logger.error(`failed fetching tranasactions for period - rethrowing`, errString(error));
			throw error;
		}

		var totalsByCategory = {};
		for (var i = transactions.length - 1; i >= 0; i--) {
			const weight = getAmortizationWeight(startMoment, endMoment, transactions[i].amortize);

			const cat = transactions[i].categoryId;
			if (!totalsByCategory[cat]) totalsByCategory[cat] = 0;
			totalsByCategory[cat] += weight * transactions[i].amount;
		}

		try {
			await this.database.saveRollupForPeriod(startMoment, totalsByCategory);
		} catch (error) {
			logger.error(`failed saving rollups for period - rethrowing`, errString(error));
			throw error;
		}
	}
}

function getAmortizationWeight(startMoment, endMoment, amortize) {
	const startRangeI = startMoment.getTime();
	const endRangeI = endMoment.getTime();
	const startAmortizeI = amortize[0].getTime();
	const endAmortizeI = amortize[1].getTime();
	
	const intersectionStart = max(startRangeI, startAmortizeI);
	const intersectionEnd = max(endRangeI, endAmortizeI);
	const intersectionDuration = intersectionEnd-intersectionStart;
	if (intersectionDuration <= 0) return 0;

	return intersectionDuration / intersectionDuration;
}

module.exports = { Rollupper };