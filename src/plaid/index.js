const { DateTime } = require('luxon');
const Logger = require('node-json-logger');

const logger = new Logger();

class PlaidManager {
  constructor(plaid, database, stats) {
    this.plaid = plaid;
    this.database = database;
    this.stats = stats.getChildClient('plaidmanager');
  }

  async pullRecentTransactions(itemId, lookbackDays) {
    logger.info('refreshing transactions', {
      plaid_item_id: itemId,
      lookback_days: lookbackDays,
    });

    const acct = await this.database.getSyncedAccount('PLAID', itemId);

    const today = DateTime.local();
    const endDate = today.toFormat('yyyy-MM-dd');
    const startDate = today
      .minus({
        days: lookbackDays,
      })
      .toFormat('yyyy-MM-dd');

    let totalRecords = 0;
    const plaidAccountsReference = {};
    while (true) {
      const trResponse = await this.plaid.getTransactions(
        acct.sourceSystemAuth.access_token,
        startDate,
        endDate,
        {
          count: 250,
          offset: totalRecords,
        },
      );

      if (trResponse.transactions.length === 0) break;

      totalRecords += trResponse.transactions.length;

      for (let i = trResponse.accounts.length - 1; i >= 0; i--) {
        const plaidAcct = trResponse.accounts[i];
        plaidAccountsReference[plaidAcct.account_id] =
          plaidAccountsReference[plaidAcct.account_id] || plaidAcct;
      }

      logger.info(`upserting ${trResponse.transactions.length} transactions`);
      for (let i = trResponse.transactions.length - 1; i >= 0; i--) {
        const tr = trResponse.transactions[i];
        await this.database.upsertTransaction({
          sourceSystem: 'PLAID',
          syncedAccountId: acct.id,
          sourceSystemId: tr.transaction_id,
          sourceSystemMeta: tr,

          transactionDate: tr.date,
          merchant: tr.merchant_name,
          amount: tr.amount,
          institution: plaidAccountsReference[tr.account_id].name,
          notes: tr.name,
        });
        this.stats.increment('plaid_transaction_upserted');
      }
    }

    this.stats.increment('successful_plaid_refresh');
  }

  async deletePlaidTransactions(plaidTransactionIds) {
    for (let i = plaidTransactionIds.length - 1; i >= 0; i--) {
      await this.database.deleteSourceSystemTransaction(
        'PLAID',
        plaidTransactionIds[i],
      );
      this.stats.increment('transaction_revoked');
    }

    this.stats.increment('successful_revocation');
  }
}

module.exports = { PlaidManager };
