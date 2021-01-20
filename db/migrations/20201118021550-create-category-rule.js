module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('category_rules', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      categoryId: {
        type: Sequelize.UUID,
        references: { model: 'categories', key: 'id' },
        field: 'category_id',
        allowNull: true,
      },
      isTransfer: { type: Sequelize.BOOLEAN, field: 'is_transfer' },

      field: {
        type: Sequelize.STRING,
        isIn: [['merchant', 'notes', 'amount']],
      },
      type: {
        type: Sequelize.STRING,
        isIn: [['regex', 'numeric', 'csv_field_regex']],
      },
      string: { type: Sequelize.STRING, allowNull: true },
      number: { type: Sequelize.DOUBLE, allowNull: true },
      meta: { type: Sequelize.JSONB, allowNull: true },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('category_rules');
  },
};
