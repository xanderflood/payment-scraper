'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const trs_to_delete = await queryInterface.sequelize.query(`
DELETE FROM transactions WHERE id IN
( SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY source_system, source_system_id
      ORDER BY  "createdAt" ASC
    ) as rank
    FROM transactions
    WHERE source_system_id IS NOT NULL
  ) as ranked_duplicates WHERE rank > 1
);
`);

    await queryInterface.sequelize.query(`CREATE UNIQUE INDEX transaction_source_system ON transactions (source_system, source_system_id)`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP INDEX transaction_source_system`);
  }
};
