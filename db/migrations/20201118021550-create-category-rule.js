'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('category_rules', {
      id: { type: Sequelize.UUID, primaryKey: true },
      categoryId: { type: Sequelize.UUID, references: { model: 'categories', key: 'id' }, field: "category_id" },

      field:  { type: Sequelize.STRING, isIn: [["merchant", "notes", "amount"]] },
      type:   { type: Sequelize.STRING, isIn: [["regex", "numeric"]] },
      string: { type: Sequelize.STRING, allowNull: true },
      number: { type: Sequelize.DOUBLE, allowNull: true },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('category_rules');
  }
};
