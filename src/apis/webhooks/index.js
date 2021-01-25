const bodyParser = require('body-parser');
const express = require('express');
const jwt = require('express-jwt');
const cacheManager = require('cache-manager');
const { JWK } = require('node-jwk');
const compare = require('secure-compare');
const sha256 = require('js-sha256');
const Logger = require('node-json-logger');
const amqp = require('amqplib');
const { errString } = require('../../utils');

const logger = new Logger();

class WebhookServer {
  constructor(port, publishRefresh, publishRevoke) {
    this.port = port;
    this.app = express();

    // TODO incorporate caching
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
          publishRevoke({
            plaid_transaction_ids: request.body.removed_transactions,
          });
        } else if (
          WebhookServer.shouldRefreshTransactions(request.body.webhook_code)
        ) {
          publishRefresh({
            item_id: request.body.item_id,
            lookback_days: WebhookServer.lookbackDaysForCode(
              request.body.webhook_code,
            ),
          });
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

  static shouldRefreshTransactions(webhookCode) {
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
