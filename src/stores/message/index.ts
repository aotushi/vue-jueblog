import { defineStore } from 'pinia'
import { api } from '@/request/index'
import { ref } from 'vue'
import type { Message, comments } from '@/request/path/message'
import { ElMessage } from 'element-plus'
import type { PraiseType } from '@/pages/message/index.vue'
import type { IAnyObj } from '@/request/http'
import { useUserStore } from '@/stores'

interface FollowDataType {
  _id: string
  user_id: string
  fans_id: string
  created_at: string
  __v: number
  fans_info: {
    _id: string
    phone: string
    username: string
    avatar: string
    introduc: string
    position: string
  }
  is_follow: boolean
}

export interface FollowType {
  meta: {
    total: number
    page: number
    per_page: number
  }
  data: FollowDataType[]
}
export const useMessageStore = defineStore(
  'message',
  () => {
    const msgInfo = ref<Message>({
      comment: 0,
      praise: 0,
      follow: 0,
      total: 0,
    })

    async function getMessage() {
      try {
        const { user_state } = useUserStore()
        if (!user_state.user_info || !localStorage.getItem('jueblog_token'))
          return

        const res = await api.messageApi.getMessages()

        const [err, data] = res

        if (!err && data) {
          const { errno, errmsg: err_msg, data: msg_data } = data

          if (msg_data && !errno && !err_msg) {
            msgInfo.value = msg_data
          }
        }
      } catch (err) {
        ElMessage.error('获取消息失败' + err)
      }
    }

    // 评论
    async function getComment(fun: (res: comments) => void, page = 1) {
      try {
        const res = await api.messageApi.getComments(page)
        const [err, data] = res
        if (!err && data?.data) {
          fun(data.data as unknown as comments)
        }
      } catch (err) {
        ElMessage.error('获取评论失败' + err)
      }
    }

    // 点赞
    async function getPraises(
      fun: (res: { meta: IAnyObj; data: PraiseType[] } | null) => void,
      page = 1,
    ) {
      try {
        const res = await api.messageApi.getPraises(page)
        const [err, data] = res
        if (!err && data?.data) {
          fun(data.data as { meta: IAnyObj; data: PraiseType[] })
        } else {
          fun(null)
        }
      } catch (error) {
        fun(null)
        ElMessage.error('获取点赞失败' + error)
      }
    }

    async function getFollows(fun: (res: FollowType | null) => void, page = 1) {
      try {
        const res = await api.messageApi.getFollows(page)
        const [err, data] = res
        if (!err && data?.data) {
          fun(data.data as unknown as FollowType)
        } else {
          fun(null)
        }
      } catch (error) {
        fun(null)
        ElMessage.error('获取关注失败' + error)
      }
    }

    return {
      msgInfo,
      getMessage,
      getComment,
      getPraises,
      getFollows,
    }
  },
  {
    persist: true,
  },
)
