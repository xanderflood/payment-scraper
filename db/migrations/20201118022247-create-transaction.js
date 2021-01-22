module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      shortId: {
        type:
          'varchar GENERATED ALWAYS AS (substring(id::varchar FROM 1 FOR 5)) STORED UNIQUE',
        field: 'short_id',
      },

      // scraper metadata
      sourceSystem: { type: Sequelize.STRING, field: 'source_system' },
      sourceSystemId: { type: Sequelize.STRING, field: 'source_system_id' },
      sourceSystemMeta: { type: Sequelize.JSONB, field: 'source_system_meta' },
      sourceSystemDigest: {
        type: Sequelize.STRING,
        field: 'source_system_digest',
      },

      // inferred fields
      transactionDate: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'transaction_date',
      },
      institution: { type: Sequelize.STRING },
      merchant: { type: Sequelize.STRING },
      amountString: { type: Sequelize.STRING, field: 'amount_string' },
      amount: { type: Sequelize.DOUBLE, allowNull: false },
      notes: { type: Sequelize.STRING },

      // manual fields
      isTransfer: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_transfer',
      },
      isRefunded: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_refunded',
      },
      isPossibleDuplicate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_possible_duplicate',
      },
      isProcessed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_processed',
      },
      systemNotes: { type: Sequelize.STRING, field: 'system_notes' },

      categoryId: {
        type: Sequelize.UUID,
        references: { model: 'categories', key: 'id' },
        field: 'category_id',
      },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('transactions');
  },
};
