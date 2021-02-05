const oclif = require('@oclif/command');
const plaid = require('plaid');
const Logger = require('node-json-logger');
const mq = require('../mq');
const { WebhookServer } = require('../apis/webhooks');

const logger = new Logger();

class WebhookAPICommand extends oclif.Command {
  async run() {
    const { flags } = this.parse(WebhookAPICommand);
    const plaidClient = new plaid.Client({
      clientID: flags.clientID,
      secret: flags.secret,
      env: plaid.environments[flags.plaidEnv],
    });

    const channel = await mq.Connect(flags.amqpAddress);
    const pubRefresh = new mq.Producer(channel, flags.refreshQueueName);
    const pubRevoke = new mq.Producer(channel, flags.revokeQueueName);
    await pubRefresh.init();
    await pubRevoke.init();

    const app = new WebhookServer(
      flags.port,
      plaidClient,
      pubRefresh,
      pubRevoke,
    );

    logger.info('starting webhook API...');
    app.start();
  }
}

WebhookAPICommand.description = `Start the webhook API server
`;

WebhookAPICommand.flags = {
  amqpAddress: oclif.flags.string({
    char: 'a',
    env: 'AMQP_ADDRESS',
    description: 'address of the AMQP server to use',
    required: true,
  }),
  refreshQueueName: oclif.flags.string({
    char: 'a',
    env: 'REFRESH_QUEUE_NAME',
    description: 'name of the AMQP queue from which to consume refresh events',
    default: 'refresh-plaid-transactions',
  }),
  revokeQueueName: oclif.flags.string({
    char: 'a',
    env: 'REVOKE_QUEUE_NAME',
    description: 'name of the AMQP queue from which to consume revoke events',
    default: 'revoke-plaid-transactions',
  }),
  port: oclif.flags.integer({
    char: 'p',
    env: 'APP_PORT',
    description: 'server port',
    default: 8081,
  }),
  development: oclif.flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
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
};

module.exports = WebhookAPICommand;
