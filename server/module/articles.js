const mongoose = require('mongoose')
const { categories } = require('../config/static')
const { ObjectId } = mongoose.Types

const articlesSchema = new mongoose.Schema({
  title: {
    type: String,
    required() {
      return this.status == 1
    },
  },
  intro: {
    type: String,
    required() {
      return this.status == 1
    },
  },
  content: {
    type: String,
    required() {
      return this.status == 1
    },
  },

  category: {
    type: String,
    enum: categories.map(cate => cate.key),
    required() {
      return this.status == 1
    },
  },
  status: { type: Number, enum: [0, 1], default: 0 },
  tags: { type: ObjectId },
  page_view: { type: Number, default: 0 },
  created_at: {
    type: Date,
    default: function () {
      // 使用本地时间
      return new Date(Date.now() + 8 * 60 * 60 * 1000) // UTC+8
    },
  },
  updated_at: {
    type: Date,
    default: function () {
      // 使用本地时间
      return new Date(Date.now() + 8 * 60 * 60 * 1000) // UTC+8
    },
  },
  created_by: { type: ObjectId, required: true }, //文章创建者
})

const Model = mongoose.model('Articles', articlesSchema)

module.exports = Model
