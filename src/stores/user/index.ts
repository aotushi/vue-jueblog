import { defineStore } from 'pinia'
import { api } from '@/request/index'
import { ref } from 'vue'
import type { IAnyObj } from '@/request/http'
import { ElMessage } from 'element-plus'
import request from '@/request/index'

export interface UserType {
  _id: string
  phone: string
  username: string
  avatar: string
  introduc: string
  company: string
  position: string
  good_num: number
  jue_power: number
  read_num: number
  fans_num?: number
  follow_num?: number
}

const getInitialData = (): {
  show_tips: boolean
  need_login: boolean
  user_info: UserType
} => ({
  show_tips: false,
  need_login: false,
  user_info: <UserType>{
    _id: '',
    phone: '',
    username: '',
    avatar: '',
    introduc: '',
    company: '',
    position: '',
    good_num: 0,
    jue_power: 0,
    read_num: 0,
    fans_num: 0,
    follow_num: 0,
  },
})

export const useUserStore = defineStore(
  'user',
  () => {
    const user_state = ref({
      ...getInitialData(),
    })

    function resetUserState() {
      user_state.value = {
        ...getInitialData(),
      }
    }
    function showLogin(): void {
      user_state.value.need_login = !user_state.value.need_login
    }

    function setTips(bool = true) {
      user_state.value.show_tips = bool
    }

    function setUserInfo(info: UserType | Record<string, unknown>) {
      const raw = info as Record<string, unknown>
      const normalized = {
        ...raw,
        _id: (raw._id as string) || String(raw.id ?? ''),
      } as UserType
      user_state.value.user_info = normalized
      localStorage.setItem('jueblog_user_info', JSON.stringify(normalized))
    }
    // 登录
    async function login(form: IAnyObj, fun: (code: number) => void) {
      try {
        const res = await api.login(form)
        const [err, resData] = res

        if (err) {
          const msg = (err as { response?: { data?: { message?: string } } })
            .response?.data?.message
          fun(msg === '用户不存在' ? 20002 : 400)
          return
        }

        if (resData?.data) {
          const data = resData.data as Record<string, unknown>
          if (data.token) {
            localStorage.setItem('jueblog_token', data.token as string)
            user_state.value.user_info = {
              ...(data as unknown as UserType),
              _id: String(data.id),
            }
            fun(200)
          } else {
            fun(500)
          }
        }
      } catch (error) {
        fun(500)
        ElMessage.error('登录失败' + error)
      }
    }

    // 注册
    async function register(form: IAnyObj, fun: (code: number) => void) {
      try {
        const [error, res] = await api.register(form)
        if (error) {
          fun(400)
          return
        }
        if (res?.data && (res.data as Record<string, unknown>).id) {
          // 注册成功，自动登录
          ElMessage.success('注册成功')
          await login(form, fun)
        } else {
          ElMessage.error('注册失败')
          fun(500)
        }
      } catch (error) {
        fun(500)
        ElMessage.error('注册失败' + error)
      }
    }

    // 关注/取消关注
    async function toggleFollow(
      dataParams: Record<string, string>,
      fun?: (data: unknown) => void,
    ) {
      try {
        const res = await api.toggleFollow(dataParams)
        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            const { data: followData } = data
            if (fun) {
              fun(followData)
            }
          }
        }
      } catch (error) {
        ElMessage.error('操作失败' + error)
      }
    }

    // 检测是否关注某个用户
    async function checkFollow(user_id: string, fun?: (data: unknown) => void) {
      try {
        const res = await api.checkFollow(user_id)
        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            const { data: followData } = data
            if (fun) {
              fun((followData as { followed: boolean }).followed ?? false)
            }
          }
        }
      } catch (error) {
        ElMessage.error('操作失败' + error)
      }
    }

    // 获取用户信息
    async function getUser(id: string, fun?: (data: unknown) => void) {
      try {
        const resolvedId = id === 'self' ? user_state.value.user_info?._id : id
        if (!resolvedId) return
        const res = await api.getUser(resolvedId)
        const [err, data] = res
        if (!err && data?.data) {
          if (id === 'self') {
            setUserInfo(data.data)
          }
          if (fun) {
            fun(data.data)
          }
        }
      } catch (error) {
        ElMessage.error('获取用户信息失败' + error)
      }
    }

    // 修改用户信息
    async function updateUser(
      id: string,
      data: Partial<UserType>,
      fun?: (data: unknown) => void,
    ) {
      try {
        const resolvedId = id === 'self' ? user_state.value.user_info?._id : id
        if (!resolvedId) return
        const res = await request.put('/api2/users/update/' + resolvedId, data)
        const [err, dataRes] = res
        if (!err && dataRes?.data) {
          setUserInfo(dataRes.data)
          if (fun) {
            fun(dataRes.data)
          }
        }
      } catch (error) {
        console.log(error)
      }
    }

    return {
      user_state,
      showLogin,
      setTips,
      setUserInfo,
      login,
      register,
      toggleFollow,
      checkFollow,
      getUser,
      resetUserState,
      updateUser,
    }
  },
  {
    // persist: true,
    persist: {
      key: 'user_state',
      storage: localStorage,
      pick: ['user_state.user_info'],
      omit: ['user_state.show_tips', 'user_state.need_login'],
    },
  },
)
