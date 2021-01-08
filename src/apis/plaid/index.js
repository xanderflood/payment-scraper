const express = require('express');
const { Router } = require('express');
const bodyParser = require('body-parser');
const plaid = require('plaid');
const { statsdPath } = require('../../utils');

const Logger = require('node-json-logger');
const logger = new Logger();

class PlaidServer {
  constructor (configuration, database, plaid) {
    this.configuration = configuration;
    this.router = new Router();
    this.database = database;
    this.client = plaid;

    this.router.use(bodyParser.urlencoded({extended: false}));
    this.router.use(bodyParser.json());

    this.router.post('/info', statsdPath('plaid_info'), async (request, response) => {
      // TODO this should be re-written to produce an
      // array of items from the user id in a JWT
      response.json({
        access_token: null,
        item_id: null,
      });
    });

    this.router.post('/create_link_token', statsdPath('plaid_create_link_token'), this.createLinkToken.bind(this));
    this.router.post('/save_synced_account', statsdPath('plaid_save_synced_account'), this.saveSyncedAccount.bind(this));
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
}

module.exports = { PlaidServer }
