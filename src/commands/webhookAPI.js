const oclif = require('@oclif/command');
const plaid = require('plaid');
const Logger = require('node-json-logger');
const { Database } = require('../database');
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
    const db = new Database(flags.development);
    const app = new WebhookServer(flags.port, db, plaidClient);

    logger.info('starting webhook API...');

    app.start();
  }
}

WebhookAPICommand.description = `Start the webhook API server
`;

WebhookAPICommand.flags = {
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
  plaidEnv: oclif.flags.string({ char: 'e', env: 'PLAID_ENV', required: true }),
};

module.exports = WebhookAPICommand;
