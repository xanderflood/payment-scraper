'use strict';
const { v4: uuidv4 } = require('uuid');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  const Category = require('./category')(sequelize, DataTypes);

  class CategoryRule extends Model {};
  CategoryRule.init({
    // NOTE: autoIncrement is a hack to prevent Sequelize from pushing a null value on create
    id: { type: DataTypes.UUID, primaryKey: true, autoIncrement: true },
    categoryId: { type: DataTypes.UUID, references: { model: Category, key: 'id' }, field: "category_id" },
    isTransfer: { type: DataTypes.BOOLEAN, field: "is_transfer" },

    field:  { type: DataTypes.STRING, isIn: [["merchant", "notes", "amount"]] },
    type:   { type: DataTypes.STRING, isIn: [["regex", "numeric", "csv_field_regex"]] },
    string: { type: DataTypes.STRING, allowNull: true },
    number: { type: DataTypes.DOUBLE, allowNull: true },
    meta:   { type: DataTypes.JSONB,  allowNull: true },
  }, {
    sequelize,
    modelName: 'CategoryRule',
    tableName: "category_rules",
  });
  return CategoryRule;
};
