const bodyParser = require('body-parser');
const express = require('express');
const jwt = require('express-jwt');
const cacheManager = require('cache-manager');
const { JWK } = require('node-jwk');
const compare = require('secure-compare');
const sha256 = require('js-sha256');
const { DateTime } = require('luxon');
const Logger = require('node-json-logger');
const { errString } = require('../../utils');

const logger = new Logger();

class WebhookServer {
  constructor(port, database, plaid) {
    this.port = port;
    this.app = express();
    this.database = database;
    this.client = plaid;

    this.keyCache = cacheManager.caching({ store: 'memory', max: 256 });

    this.app.post(
      '/v1/webhooks/plaid',
      this.getPlaidWebhookJwtConfig(),
      bodyParser.json({ verify: WebhookServer.verifySignature }),
      async (request, response) => {
        logger.info(
          `processing plaid webhook {type=${request.body.webhook_type}, code=${request.body.webhook_code}}`,
        );

        if (request.body.webhook_type !== 'TRANSACTIONS') {
          return;
        }

        if (WebhookServer.shouldRemoveTransactions(request.body.webhook_code)) {
          const nTr = request.body.removed_transactions.length;
          for (let i = nTr - 1; i >= 0; i--) {
            try {
              await this.database.deleteSourceSystemTransaction(
                'PLAID',
                request.body.removed_transactions[i],
              );
            } catch (error) {
              logger.error(
                'error deleting transaction - responding with 500',
                errString(error),
              );
              response.status(500).json({});
              return;
            }
          }

          response.json({});
          return;
        }
        if (WebhookServer.shouldSaveTransactions(request.body.webhook_code)) {
          logger.info('upserting transactions', {
            plaid_item_id: request.body.webhook_code,
          });
          let acct;
          try {
            acct = await database.getSyncedAccount(
              'PLAID',
              request.body.item_id,
            );
          } catch (error) {
            logger.error(
              'error fetching account credentials from DB - responding with 500',
              errString(error),
            );
            response.status(500).json({});
            return;
          }

          const today = DateTime.local();
          const endDate = today.toFormat('yyyy-MM-dd');
          const startDate = today
            .minus({
              days: WebhookServer.lookbackDaysForCode(
                request.body.webhook_code,
              ),
            })
            .toFormat('yyyy-MM-dd');

          let totalRecords = 0;
          const plaidAccountsReference = {};
          while (true) {
            let trResponse;
            try {
              // TODO add some retrying - or switch to an event framework?
              trResponse = await this.client.getTransactions(
                acct.sourceSystemAuth.access_token,
                startDate,
                endDate,
                {
                  count: 250,
                  offset: totalRecords,
                },
              );
            } catch (error) {
              logger.error(
                'error fetching transactions from Plaid - responding with 500',
                errString(error),
              );
              response.status(500).json({});
              return;
            }

            if (trResponse.transactions.length === 0) break;

            totalRecords += trResponse.transactions.length;

            for (let i = trResponse.accounts.length - 1; i >= 0; i--) {
              const plaidAcct = trResponse.accounts[i];
              plaidAccountsReference[plaidAcct.account_id] =
                plaidAccountsReference[plaidAcct.account_id] || plaidAcct;
            }

            logger.info(
              `upserting ${trResponse.transactions.length} transactions`,
            );
            for (let i = trResponse.transactions.length - 1; i >= 0; i--) {
              // TODO stats alerting for errors
              const tr = trResponse.transactions[i];
              try {
                await this.database.upsertSyncedTransaction({
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
              } catch (error) {
                logger.error(
                  'error saving transactions to DB - carrying on',
                  errString(error),
                );
              }
            }
          }

          response.json({});
        } else {
          logger.error(
            'unrecognized plaid webhook code - responding with 200 to ignore:',
            request.body.webhook_code,
          );
          response.json({});
        }
      },
    );
  }

  static shouldSaveTransactions(webhookCode) {
    return (
      webhookCode === 'INITIAL_UPDATE' ||
      webhookCode === 'HISTORICAL_UPDATE' ||
      webhookCode === 'DEFAULT_UPDATE'
    );
  }

  static lookbackDaysForCode(webhookCode) {
    return webhookCode === 'DEFAULT_UPDATE' ? 7 : 365;
  }

  static shouldRemoveTransactions(webhookCode) {
    return webhookCode === 'TRANSACTIONS_REMOVED';
  }

  static verifySignature(req, res, buf) {
    // reject tokens older than five minutes, per Plaid's recommendation
    if (Math.floor(+new Date() / 1000) - req.user.iat > 300) {
      throw new Error('received webhook request with stale token');
    }

    if (!compare(req.user.request_body_sha256, sha256(buf))) {
      throw new Error('invalid webhook request signature');
    }

    return false;
  }

  getPlaidWebhookJwtConfig() {
    const self = this;
    return jwt({
      algorithms: ['ES256'],
      getToken: (req) => req.headers['plaid-verification'],

      secret(req, header, payload, cb) {
        self
          .getPlaidWebhookJWTKeyByID(header.kid)
          .catch((err) => cb(err, null))
          .then((key) => cb(null, key));
      },
    });
  }

  async getPlaidWebhookJWTKeyByID(kid) {
    const resp = await this.client.getWebhookVerificationKey(kid);
    return JWK.fromObject(resp.key).key.toPublicKeyPEM();
  }

  start() {
    const self = this;
    this.app.listen(this.port, () => {
      logger.info(`plaid- webhook server listening on 0.0.0.0:${self.port}`);
    });
  }
}

module.exports = { WebhookServer };
