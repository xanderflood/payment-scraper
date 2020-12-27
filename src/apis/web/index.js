const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const plaid = require('plaid');

const Logger = require('node-json-logger');
const logger = new Logger();

class WebServer {
  constructor (configuration, database, plaid) {
    this.configuration = configuration;
    this.app = express();
    this.app.use(bodyParser.json());
    this.database = database;
    this.client = plaid;

    this.app.use(express.static('public'));
    this.app.use(bodyParser.urlencoded({extended: false}));
    this.app.use(bodyParser.json());

    this.app.get('/', function (request, response, next) {
      response.sendFile('./public/index.html', { root: process.cwd() });
    });

    this.app.post('/api/info', async (request, response) => {
      // TODO this should be re-written to produce an
      // array of items from the user id in a JWT
      response.json({
        access_token: null,
        item_id: null,
      });
    });

    this.app.post('/api/create_link_token', this.createLinkToken.bind(this));
    this.app.post('/api/save_synced_account', this.saveSyncedAccount.bind(this));
  }

  async createLinkToken(request, response) {
    // TODO: This should correspond to a unique id for the current user.
    try {
      const linkConfig = this.plaidLinkConfigForUserId('user-id');
      response.json(await this.client.createLinkToken(linkConfig));
    } catch (error) {
      logger.error("error creating a plaid link token - responding with 500:", error);
      return response.status(500).json({
        error: error,
      });
    }
  }

  async saveSyncedAccount(request, response) {
    try {
      var { item_id, access_token } = await this.client.exchangePublicToken(request.body.public_token);
    } catch (error) {
      logger.error("error exchanging token - responding with 500:", error);
      return response.status(500).json({});
    }

    try {
      var { item } = await this.client.getItem(access_token);
    } catch (error) {
      logger.error("error fetching item - responding with 500:", error);
      return response.status(500).json({});
    }

    try {
      var { institution } = await this.client.getInstitutionById(item.institution_id);
    } catch (error) {
      logger.error("error fetching institution - responding with 500:", error);
      return response.status(500).json({});
    }

    try {
      await this.database.saveSyncedAccount({
        sourceSystem: "PLAID",
        sourceSystemId: item_id,
        sourceSystemMeta: {
          item: item,
          institution: institution,
        },
        sourceSystemAuth: {
          access_token: access_token,
          public_token: item_id,
        },
      });

    } catch (error) {
      logger.error("error saving to db - responding with 500", error);
      return response.status(500).json({});
    }

    response.json({ access_token, item_id });
  }

  plaidLinkConfigForUserId(userID) {
    return {
      user: {
        client_user_id: userID,
      },
      client_name: this.configuration.plaidClientName,
      products: ['transactions'],
      country_codes: ['US','CA'],
      language: 'en',

      webhook: this.configuration.webhookURL,
    };
  }

  start() {
    const self = this;
    this.app.listen(this.configuration.appPort, function () {
      logger.info('webserver listening on 0.0.0.0:' + self.configuration.appPort);
    });
  }
}

module.exports = { WebServer }
