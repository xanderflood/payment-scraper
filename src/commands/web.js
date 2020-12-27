const { Command, flags } = require('@oclif/command')
const { Database } = require('../database');
const { WebServer } = require('../apis/web');
const plaid = require('plaid');

const Logger = require('node-json-logger');
const logger = new Logger();

class WebCommand extends Command {
  async run() {
    const {flags} = this.parse(WebCommand);

    const configuration = {
      appPort:         flags.port,
      webhookURL:      flags.webhookURL,
      plaidClientName: flags.plaidClientName,
      plaidEnv:        flags.plaidEnv,
    }

    const plaidClient = new plaid.Client({
      clientID: flags.clientID,
      secret: flags.secret,
      env: plaid.environments[configuration.plaidEnv],
    });
    const database = new Database();

    const app = new WebServer(configuration, database, plaidClient);
    app.start();
  }
}

WebCommand.description = `Start the webhook API server
`

WebCommand.flags = {
  port: flags.integer({char: 'p', env: "APP_PORT", description: 'server port', default: 8080}),
  webhookURL: flags.string({char: 'w', env: "WEBHOOK_URL", description: 'URL of the webhook server', required: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
  clientID: flags.string({char: 'i', env: "PLAID_CLIENT_ID", required: true}),
  secret: flags.string({char: 's', env: "PLAID_SECRET", required: true}),
  plaidEnv: flags.string({char: 'e', env: "PLAID_ENV", default: 'sandbox'}),
  plaidClientName: flags.string({char: 'e', env: "PLAID_CLIENT_NAME", default: 'Blue House'}),
}

module.exports = WebCommand
