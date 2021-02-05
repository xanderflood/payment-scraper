const oclif = require('@oclif/command');
const plaid = require('plaid');
const Logger = require('node-json-logger');
const Statsd = require('statsd-client');
const { Database } = require('../database');
const { PlaidManager } = require('../plaid');
const { errString } = require('../utils');
const mq = require('../mq');

class RefreshPlaidTransactionsConsumerCommand extends oclif.Command {
  async run() {
    const { flags } = this.parse(RefreshPlaidTransactionsConsumerCommand);

    const plaidClient = new plaid.Client({
      clientID: flags.clientID,
      secret: flags.secret,
      env: plaid.environments[flags.plaidEnv],
    });
    const statsd = new Statsd();
    const msgStats = statsd.getChildClient('plaid_revoke_consumer');
    const logger = new Logger();
    const db = new Database(flags.development);
    const pm = new PlaidManager(plaidClient, db, statsd);

    const channel = await mq.Connect(flags.amqpAddress);
    const consumer = new mq.Consumer(channel, flags.revokeQueueName, msgStats);
    await consumer.init();

    logger.info('starting revoke consumer...');
    consumer.consume(async (msg, reject, fail, success) => {
      if (
        typeof msg.plaid_transaction_ids !== 'string' ||
        !msg.plaid_transaction_ids.length
      ) {
        reject(msg, false);
        return;
      }

      try {
        await pm.deletePlaidTransactions(msg.plaid_transaction_ids);
      } catch (error) {
        logger.error('failed revoking plaid transactions', {
          error: errString(error),
        });
        fail();
        return;
      }

      success();
    });
  }
}

RefreshPlaidTransactionsConsumerCommand.description = `Start the web server
`;

RefreshPlaidTransactionsConsumerCommand.flags = {
  amqpAddress: oclif.flags.string({
    char: 'a',
    env: 'AMQP_ADDRESS',
    description: 'address of the AMQP server to use',
    required: true,
  }),
  revokeQueueName: oclif.flags.string({
    char: 'a',
    env: 'REVOKE_QUEUE_NAME',
    description: 'name of the AMQP queue from which to consume revoke events',
    default: 'revoke-plaid-transactions',
  }),
  clientID: oclif.flags.string({
    char: 'i',
    env: 'PLAID_CLIENT_ID',
    required: true,
  }),
  secret: oclif.flags.string({
    char: 's',
    env: 'PLAID_SECRET',
    required: true,
  }),
  plaidEnv: oclif.flags.string({
    char: 'e',
    env: 'PLAID_ENV',
    default: 'sandbox',
  }),
  statsdAddress: oclif.flags.string({
    char: 't',
    env: 'STATSD_ADDRESS',
    required: false,
  }),
};

module.exports = RefreshPlaidTransactionsConsumerCommand;
