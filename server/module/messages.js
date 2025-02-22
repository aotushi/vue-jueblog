let mongoose = require('mongoose')
const { ObjectId } = mongoose.Types

let messagesModel = new mongoose.Schema({
  user_id: { type: ObjectId, required: true },
  source_id: { type: ObjectId, required: true },
  type: { type: Number, enum: [1, 2, 3], required: true },
  status: { type: Number, enum: [0, 1], default: 0, required: true },
  created_at: {
    type: Date,
    default: function () {
      // 使用本地时间
      return new Date(Date.now() + 8 * 60 * 60 * 1000) // UTC+8
    },
  },
})

const Model = mongoose.model('messages', messagesModel)
module.exports = Model
