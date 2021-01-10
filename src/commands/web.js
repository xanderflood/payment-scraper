const { Command, flags } = require('@oclif/command')
const { Database } = require('../database');
const { Processor } = require('../processor');
const { Rollupper } = require('../rollups');
const { PlaidServer } = require('../apis/plaid');
const { UploadServer } = require('../apis/uploads');
const { TransactionServer } = require('../apis/transactions');
const express = require('express');
const plaid = require('plaid');

const expressStatsd = require('express-statsd');
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
    };
    const plaidClient = new plaid.Client({
      clientID: flags.clientID,
      secret: flags.secret,
      env: plaid.environments[configuration.plaidEnv],
    });
    const database = new Database();
    const processor = new Processor(database);
    const rollupper = new Rollupper(database);

    const uploadServer = new UploadServer(database);
    const plaidServer = new PlaidServer(configuration, database, plaidClient);
    const tranServer = new TransactionServer(database, processor, rollupper);

    const app = express();
    if (flags.statsdAddress) {
      logger.info("Adding statsd middleware")
      app.use(expressStatsd({host: flags.statsdAddress}));
    }

    app.get('/', function (request, response, next) {
      response.sendFile('./public/index.html', { root: process.cwd() });
    });

    app.use(express.static('public'));
    app.use('/api/upload', uploadServer.router);
    app.use('/api/plaid', plaidServer.router);
    app.use('/api/transactions', tranServer.router);

    app.listen(flags.port, function () {
      logger.info('webserver listening on 0.0.0.0:' + flags.port);
    });
  }
}

WebCommand.description = `Start the web server
`

WebCommand.flags = {
  port: flags.integer({char: 'p', env: "APP_PORT", description: 'server port', default: 8080}),
  webhookURL: flags.string({char: 'w', env: "WEBHOOK_URL", description: 'URL of the webhook server', required: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
  clientID: flags.string({char: 'i', env: "PLAID_CLIENT_ID", required: true}),
  secret: flags.string({char: 's', env: "PLAID_SECRET", required: true}),
  plaidEnv: flags.string({char: 'e', env: "PLAID_ENV", default: 'sandbox'}),
  plaidClientName: flags.string({char: 'n', env: "PLAID_CLIENT_NAME", default: 'Blue House'}),
  statsdAddress: flags.string({char: 't', env: "STATSD_ADDRESS", required: false}),
}

module.exports = WebCommand
