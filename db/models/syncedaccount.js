'use strict';
const { v4: uuidv4 } = require('uuid');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SyncedAccount extends Model {};
  SyncedAccount.init({
    // NOTE: id is generated on insert from gen_random_uuid()
    id:               { type: DataTypes.UUID, primaryKey: true, defaultValue: uuidv4 },
    sourceSystem:     { type: DataTypes.STRING, field: "source_system" },
    sourceSystemId:   { type: DataTypes.STRING, field: "source_system_id" },
    sourceSystemMeta: { type: DataTypes.JSONB, field: "source_system_meta" },
    sourceSystemAuth: { type: DataTypes.JSONB, field: "source_system_auth" },
  }, {
    sequelize,
    modelName: 'SyncedAccount',
    tableName: "synced_accounts",
    indexes: [
      { name: 'source_system', fields: ['source_system', 'source_system_id'] },
    ],
  });
  return SyncedAccount;
};
