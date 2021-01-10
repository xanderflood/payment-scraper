'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('rollups', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      monthStart: { type: Sequelize.DATE, field: "month_start", allowNull: false, unique: true },
      rollup:     { type: Sequelize.JSONB, allowNull: false },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addColumn('transactions', 'amortize', { type: Sequelize.RANGE(Sequelize.DATEONLY) });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('transactions', 'amortize');
    await queryInterface.dropTable('rollups');
  }
};
