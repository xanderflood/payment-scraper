'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('synced_accounts', {
      id:               { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      sourceSystem:     { type: Sequelize.STRING, field: "source_system" },
      sourceSystemId:   { type: Sequelize.STRING, field: "source_system_id" },
      sourceSystemMeta: { type: Sequelize.JSONB, field: "source_system_meta" },
      sourceSystemAuth: { type: Sequelize.JSONB, field: "source_system_auth" },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addColumn('transactions', 'synced_account_id', {
      type: Sequelize.UUID, references: { model: 'synced_accounts', key: 'id' }, field: "synced_account_id"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropColumn('transactions', 'synced_account_id');
    await queryInterface.dropTable('synced_accounts');
  }
};
