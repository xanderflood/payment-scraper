'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => await queryInterface.sequelize.query(`
CREATE OR REPLACE VIEW unprocessed_transactions AS
  SELECT transaction_date, merchant, amount, notes
    FROM transactions
    WHERE NOT is_processed
    ORDER BY transaction_date DESC;
`),

  // not necessary
  down: async (queryInterface, Sequelize) => {},
};
