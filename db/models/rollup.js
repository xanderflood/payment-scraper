'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Rollup extends Model {};
  Rollup.init({
    // NOTE: autoIncrement is a hack to prevent Sequelize from pushing a null value on create
    id: { type: DataTypes.UUID, primaryKey: true, autoIncrement: true },
    monthStart: { type: DataTypes.DATE, field: "month_start", allowNull: false, unique: true },
    rollup:     { type: DataTypes.JSONB, allowNull: false },
  }, {
    sequelize,
    modelName: 'Rollup',
    tableName: 'rollups',
  });
  return Rollup;
};