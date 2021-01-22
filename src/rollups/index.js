const Logger = require('node-json-logger');
const { DateTime } = require('luxon');
const { errString } = require('../utils');

const logger = new Logger();
const DEFAULT_LOOKBACK_MONTHS = 12;

class Rollupper {
  constructor(database) {
    this.database = database;
  }

  async upsertRollupRecordForPeriod(start, end) {
    let transactions;
    try {
      transactions = await this.database.getIntersectingTransactions(
        start.toJSDate(),
        end.toJSDate(),
      );
    } catch (error) {
      logger.error(
        `failed fetching tranasactions for period - rethrowing`,
        errString(error),
      );
      throw error;
    }

    const totalsByCategory = {};
    let weight;
    for (let i = transactions.length - 1; i >= 0; i--) {
      if (transactions[i].amortize) {
        weight = getAmortizationWeight(
          start,
          end,
          new DateTime(transactions[i].amortize[0]),
          new DateTime(transactions[i].amortize[1]),
        );
      } else {
        weight = 1;
      }

      const cat = transactions[i].category_id;
      if (!totalsByCategory[cat]) totalsByCategory[cat] = 0;
      totalsByCategory[cat] += weight * transactions[i].amount;
    }

    try {
      await this.database.saveRollupForPeriod(
        start.toJSDate(),
        totalsByCategory,
      );
    } catch (error) {
      logger.error(
        `failed saving rollups for period - rethrowing`,
        errString(error),
      );
      throw error;
    }
  }

  async rollupRecentMonths(lookbackMonths) {
    let start = Rollupper.startOfThisMonth().minus({
      months: lookbackMonths || DEFAULT_LOOKBACK_MONTHS,
    });
    let end = start.plus({ months: 1 });
    for (let i = 0; i < 12; i++) {
      try {
        await this.upsertRollupRecordForPeriod(start, end);
      } catch (error) {
        logger.error(
          `failed producing rollup for month starting ${start} - rethrowing`,
          errString(error),
        );
        throw error;
      }

      // switch to the next month
      start = end;
      end = start.plus({ months: 1 });
    }
  }

  static startOfThisMonth() {
    const start = DateTime.local();
    return DateTime.local(start.year, start.month);
  }
}

function getAmortizationWeight(
  periodStart,
  periodEnd,
  amortizeStart,
  amortizeEnd,
) {
  const intersectionDuration = DateTime.min(periodEnd, amortizeEnd);
  DateTime.max(periodStart, amortizeStart);
  if (intersectionDuration <= 0) return 0;

  const amortizeDuration = amortizeEnd - amortizeStart;
  return intersectionDuration / amortizeDuration;
}

module.exports = { Rollupper };
