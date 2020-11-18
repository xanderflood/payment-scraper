'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => await queryInterface.sequelize.query(`
CREATE OR replace VIEW monthly_totals AS
  SELECT EXTRACT(year FROM transaction_date) AS year, EXTRACT(month FROM transaction_date) AS month, cat.name AS cat_name, SUM(tr.amount) AS total
    FROM transactions AS tr
    LEFT JOIN categories AS cat
      ON cat.id = tr.category_id
    GROUP BY EXTRACT(year FROM transaction_date), EXTRACT(month FROM transaction_date), cat.id, cat.name
    ORDER BY EXTRACT(year FROM transaction_date), EXTRACT(month FROM transaction_date), cat.id;
`),

  // not necessary
  down: async (queryInterface, Sequelize) => {},
};
