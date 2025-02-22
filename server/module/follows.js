let mongoose = require('mongoose')
const { ObjectId } = mongoose.Types

let followsModel = new mongoose.Schema({
  user_id: { type: ObjectId, required: true }, // 用户 ID
  fans_id: { type: ObjectId, required: true }, // 粉丝 ID
  created_at: {
    type: Date,
    default: function () {
      // 使用本地时间
      return new Date(Date.now() + 8 * 60 * 60 * 1000) // UTC+8
    },
  },
})

const Model = mongoose.model('follows', followsModel)

module.exports = Model
