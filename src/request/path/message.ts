import http from '../index'
import type { ApiResponse, IAnyObj } from '../http'

export interface Message {
  comment: number
  praise: number
  follow: number
  total: number
}

export interface comments {
  meta: IAnyObj
  data: IAnyObj[]
}

const getMessages = <T = Message>(params?: IAnyObj): ApiResponse<T> => {
  return http.get<T>('/api2/messages/preview', params)
}

const getComments = <T = comments>(page = 1): ApiResponse<T> => {
  const params = { page }
  return http.get<T>('/api2/messages/comments', params)
}

// getPraises
const getPraises = <T = IAnyObj>(page = 1): ApiResponse<T> => {
  const params = { page }
  return http.get('/api2/messages/praises', params)
}

// getFollows
const getFollows = <T = IAnyObj>(page = 1): ApiResponse<T> => {
  const params = { page }
  return http.get('/api2/messages/follows', params)
}

export const messageApi = { getMessages, getComments, getPraises, getFollows }
