'use strict';
const { v4: uuidv4 } = require('uuid');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {};
  Category.init({
    // NOTE: autoIncrement is a hack to prevent Sequelize from pushing a null value on create
    id: { type: DataTypes.UUID, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, unique: true, allowNull: false },
    slug: { type: DataTypes.STRING, unique: true, allowNull: false },
  }, {
    sequelize,
    modelName: 'Category',
    tableName: "categories",
  });
  return Category;
};
