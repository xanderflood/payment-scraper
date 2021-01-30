const oclif = require('@oclif/command');
const plaid = require('plaid');
const Logger = require('node-json-logger');
const amqp = require('amqplib');
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

    const conn = await amqp.connect(flags.amqpAddress);
    const channel = await conn.createChannel();
    await channel.assertQueue(flags.revokeQueueName);
    await channel.assertQueue(flags.refreshQueueName);

    const publishRefresh = function (msg) {
      channel.sendToQueue(
        flags.refreshQueueName,
        Buffer.from(JSON.stringify(msg)),
        {
          persistent: true,
        },
      );
    };
    const publishRevoke = function (msg) {
      channel.sendToQueue(
        flags.revokeQueueName,
        Buffer.from(JSON.stringify(msg)),
        {
          persistent: true,
        },
      );
    };

    const app = new WebhookServer(flags.port, plaidClient, publishRefresh, publishRevoke);

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
  plaidEnv: oclif.flags.string({ char: 'e', env: 'PLAID_ENV', default: 'sandbox' }),
};

module.exports = WebhookAPICommand;
