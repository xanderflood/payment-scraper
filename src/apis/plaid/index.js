const { Router } = require('express');
const bodyParser = require('body-parser');
const Logger = require('node-json-logger');
const { statsdPath } = require('../../utils');

const logger = new Logger();

class PlaidServer {
  constructor(configuration, database, plaid) {
    this.configuration = configuration;
    this.router = new Router();
    this.database = database;
    this.client = plaid;

    this.router.use(bodyParser.urlencoded({ extended: false }));
    this.router.use(bodyParser.json());

    this.router.post(
      '/info',
      statsdPath('plaid_info'),
      async (request, response) => {
        // TODO this should be re-written to produce an
        // array of items from the user id in a JWT
        response.json({
          access_token: null,
          item_id: null,
        });
      },
    );

    this.router.post(
      '/create_link_token',
      statsdPath('plaid_create_link_token'),
      this.createLinkToken.bind(this),
    );
    this.router.post(
      '/save_synced_account',
      statsdPath('plaid_save_synced_account'),
      this.saveSyncedAccount.bind(this),
    );
  }

  async createLinkToken(request, response) {
    // TODO: This should correspond to a unique id for the current user.
    try {
      const linkConfig = this.plaidLinkConfigForUserId('user-id');
      response.json(await this.client.createLinkToken(linkConfig));
    } catch (error) {
      logger.error(
        'error creating a plaid link token - responding with 500:',
        error,
      );
      response.status(500).json({ error });
    }
  }

  async saveSyncedAccount(request, response) {
    let itemId;
    let accessToken;
    try {
      const resp = await this.client.exchangePublicToken(
        request.body.public_token,
      );
      itemId = resp.item_id;
      accessToken = resp.access_token;
    } catch (error) {
      logger.error('error exchanging token - responding with 500:', error);
      response.status(500).json({});
      return;
    }

    let item;
    try {
      const resp = await this.client.getItem(accessToken);
      item = resp.item;
    } catch (error) {
      logger.error('error fetching item - responding with 500:', error);
      response.status(500).json({});
      return;
    }

    let institution;
    try {
      const resp = await this.client.getInstitutionById(item.institution_id);
      institution = resp.institution;
    } catch (error) {
      logger.error('error fetching institution - responding with 500:', error);
      response.status(500).json({});
      return;
    }

    const sourceSystemAuth = {
      access_token: accessToken,
      public_token: request.body.public_token,
    };

    try {
      await this.database.saveSyncedAccount({
        sourceSystem: 'PLAID',
        sourceSystemId: itemId,
        sourceSystemMeta: {
          item,
          institution,
        },
        sourceSystemAuth,
      });
    } catch (error) {
      logger.error('error saving to db - responding with 500', error);
      response.status(500).json({});
      return;
    }

    response.json({ ...sourceSystemAuth, item_id: itemId });
  }

  plaidLinkConfigForUserId(userID) {
    return {
      user: {
        client_user_id: userID,
      },
      client_name: this.configuration.plaidClientName,
      products: ['transactions'],
      country_codes: ['US', 'CA'],
      language: 'en',

      webhook: this.configuration.webhookURL,
    };
  }
}

module.exports = { PlaidServer };
