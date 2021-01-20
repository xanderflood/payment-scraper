const { Command, flags } = require('@oclif/command');
const { Database } = require('../database');
const { WebhookServer } = require('../apis/webhooks');
const plaid = require('plaid');

const Logger = require('node-json-logger');
const logger = new Logger();

class WebhookAPICommand extends Command {
  async run() {
    const { flags } = this.parse(WebhookAPICommand);

    const plaidClient = new plaid.Client({
      clientID: flags.clientID,
      secret: flags.secret,
      env: plaid.environments[flags.plaidEnv],
    });
    const db = new Database(flags.development);
    const app = new WebhookServer(flags.port, db, plaidClient);
    app.start();
  }
}

WebhookAPICommand.description = `Start the webhook API server
`;

WebhookAPICommand.flags = {
  port: flags.integer({
    char: 'p',
    env: 'APP_PORT',
    description: 'server port',
    default: 8081,
  }),
  development: flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
  }),
  clientID: flags.string({ char: 'i', env: 'PLAID_CLIENT_ID', required: true }),
  secret: flags.string({ char: 's', env: 'PLAID_SECRET', required: true }),
  plaidEnv: flags.string({ char: 'e', env: 'PLAID_ENV', required: true }),
};

module.exports = WebhookAPICommand;
