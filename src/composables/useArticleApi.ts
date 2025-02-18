import { ref } from 'vue'
import { api } from '@/request/index'
// import type { Article } from '@/request/path/article'
import type { ArticleType } from '@/stores/article/type'

export function useArticleApi() {
  const articleList = ref<ArticleType[]>([])
  const error = ref<Error | null>(null)

  const getArticlesList = async () => {
    const [err, response] = await api.getArticlesList()
    if (err === null && response) {
      articleList.value = response.data.data
    } else {
      error.value = err
    }
  }

  return {
    articleList,
    error,
    getArticlesList,
  }
}
