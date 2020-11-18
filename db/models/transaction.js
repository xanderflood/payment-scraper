'use strict';
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  const Category = require('./category')(sequelize, DataTypes);

  class Transaction extends Model {};
  Transaction.init({
    id:      { type: DataTypes.UUID, primaryKey: true },
    shortId: { type: DataTypes.STRING, unique: true, field: "short_id" },

    // scraper metadata
    sourceSystem:       { type: DataTypes.STRING, field: "source_system" },
    sourceSystemId:     { type: DataTypes.STRING, field: "source_system_id" },
    sourceSystemMeta:   { type: DataTypes.JSONB, field: "source_system_meta" },
    sourceSystemDigest: { type: DataTypes.STRING, field: "source_system_digest" },

    // inferred fields
    transactionDate: { type: DataTypes.DATE, allowNull: false, field: "transaction_date" },
    institution:     { type: DataTypes.STRING, allowNull: false },
    merchant:        { type: DataTypes.STRING, allowNull: false },
    amountString:    { type: DataTypes.STRING, allowNull: false, field: "amount_string" },
    amount:          { type: DataTypes.DOUBLE, allowNull: false },
    notes:           { type: DataTypes.STRING },

    // manual fields
    isTransfer:          { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_transfer" },
    isRefunded:          { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_refunded" },
    isPossibleDuplicate: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_possible_duplicate" },
    isProcessed:         { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false, field: "is_processed" },
    systemNotes:         { type: DataTypes.STRING, field: "system_notes" },

    categoryId: { type: DataTypes.UUID, references: { model: Category, key: 'id' }, field: "category_id" },
  }, {
    sequelize,
    modelName: 'Transaction',
    tableName: "transactions",
  });
  Transaction.beforeCreate(async (tr, options) => {
    tr.id = uuidv4();
    tr.shortId = tr.id.slice(0, 5);

    tr.sourceSystemDigest = crypto.createHash('md5')
      .update(JSON.stringify(tr.sourceSystemMeta))
      .digest("hex");
  });
  return Transaction;
};
