/* eslint-disable no-param-reassign */

const crypto = require('crypto');
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Category = require('./category')(sequelize, DataTypes); // eslint-disable-line global-require
  const SyncedAccount = require('./syncedaccount')(sequelize, DataTypes); // eslint-disable-line global-require

  class Transaction extends Model {}
  Transaction.init(
    {
      // NOTE: autoIncrement is a hack to prevent Sequelize from pushing a null value on create
      id: { type: DataTypes.UUID, primaryKey: true, autoIncrement: true },
      shortId: { type: DataTypes.STRING, field: 'short_id', unique: true },

      // scraper metadata
      sourceSystem: {
        type: DataTypes.STRING,
        field: 'source_system',
        unique: 'transaction_source_system',
      },
      sourceSystemId: {
        type: DataTypes.STRING,
        field: 'source_system_id',
        unique: 'transaction_source_system',
      },
      sourceSystemMeta: { type: DataTypes.JSONB, field: 'source_system_meta' },
      sourceSystemDigest: {
        type: DataTypes.STRING,
        field: 'source_system_digest',
      },

      // inferred fields
      transactionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'transaction_date',
      },
      institution: { type: DataTypes.STRING },
      merchant: { type: DataTypes.STRING },
      amountString: { type: DataTypes.STRING, field: 'amount_string' },
      amount: { type: DataTypes.DOUBLE, allowNull: false },
      notes: { type: DataTypes.STRING },

      // manual fields
      isTransfer: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_transfer',
      },
      isRefunded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_refunded',
      },
      isPossibleDuplicate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_possible_duplicate',
      },
      isProcessed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_processed',
      },
      systemNotes: { type: DataTypes.STRING, field: 'system_notes' },

      categoryId: {
        type: DataTypes.UUID,
        references: { model: Category, key: 'id' },
        field: 'category_id',
      },
      syncedAccountId: {
        type: DataTypes.UUID,
        references: { model: SyncedAccount, key: 'id' },
        field: 'synced_account_id',
      },
    },
    {
      sequelize,
      modelName: 'Transaction',
      tableName: 'transactions',
    },
  );
  Transaction.beforeSave(async (tr) => {
    tr.sourceSystem = tr.sourceSystem || 'other';
    tr.sourceSystemId =
      tr.sourceSystemId ||
      crypto
        .createHash('md5')
        .update(
          [tr.amountString, tr.merchant, tr.merchant, tr.transactionDate].join(
            '\0',
          ),
        )
        .digest('hex');

    tr.sourceSystemDigest =
      tr.sourceSystemDigest ||
      crypto
        .createHash('md5')
        .update(JSON.stringify(tr.sourceSystemMeta))
        .digest('hex');
  });
  return Transaction;
};
