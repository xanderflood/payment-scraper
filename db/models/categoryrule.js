'use strict';
const { v4: uuidv4 } = require('uuid');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  const Category = require('./category')(sequelize, DataTypes);

  class CategoryRule extends Model {};
  CategoryRule.init({
    id: { type: DataTypes.UUID, primaryKey: true },
    categoryId: { type: DataTypes.UUID, references: { model: Category, key: 'id' }, field: "category_id" },

    field:  { type: DataTypes.STRING, isIn: [["merchant", "notes", "amount"]] },
    type:   { type: DataTypes.STRING, isIn: [["regex", "numeric"]] },
    string: { type: DataTypes.STRING, allowNull: true },
    number: { type: DataTypes.DOUBLE, allowNull: true },
  }, {
    sequelize,
    modelName: 'CategoryRule',
    tableName: "category_rules",
  });
  CategoryRule.beforeCreate(async (tr, options) => {
    tr.id = uuidv4();
  });
  return CategoryRule;
};
