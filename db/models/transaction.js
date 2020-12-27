'use strict';
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  const Category = require('./category')(sequelize, DataTypes);
  const SyncedAccount = require('./syncedaccount')(sequelize, DataTypes);

  class Transaction extends Model {};
  Transaction.init({
    // NOTE: id is generated on insert from gen_random_uuid()
    id:      { type: DataTypes.UUID, primaryKey: true },
    // as a column definition on its own
    shortId: { type: DataTypes.STRING, field: "short_id" },

    // scraper metadata
    sourceSystem:       { type: DataTypes.STRING, field: "source_system" },
    sourceSystemId:     { type: DataTypes.STRING, field: "source_system_id" },
    sourceSystemMeta:   { type: DataTypes.JSONB, field: "source_system_meta" },
    sourceSystemDigest: { type: DataTypes.STRING, field: "source_system_digest" },

    // inferred fields
    transactionDate: { type: DataTypes.DATE, allowNull: false, field: "transaction_date" },
    institution:     { type: DataTypes.STRING },
    merchant:        { type: DataTypes.STRING },
    amountString:    { type: DataTypes.STRING, field: "amount_string" },
    amount:          { type: DataTypes.DOUBLE, allowNull: false },
    notes:           { type: DataTypes.STRING },

    // manual fields
    isTransfer:          { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_transfer" },
    isRefunded:          { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_refunded" },
    isPossibleDuplicate: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_possible_duplicate" },
    isProcessed:         { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_processed" },
    systemNotes:         { type: DataTypes.STRING, field: "system_notes" },

    categoryId:      { type: DataTypes.UUID, references: { model: Category, key: 'id' }, field: "category_id" },
    syncedAccountId: { type: DataTypes.UUID, references: { model: SyncedAccount, key: 'id' }, field: "synced_account_id" },
  }, {
    sequelize,
    modelName: 'Transaction',
    tableName: "transactions",
  });
  Transaction.beforeCreate(async (tr, options) => {
    tr.sourceSystemDigest = crypto.createHash('md5')
      .update(JSON.stringify(tr.sourceSystemMeta))
      .digest("hex");
  });
  return Transaction;
};
