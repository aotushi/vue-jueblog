import { defineStore } from 'pinia'
import { api } from '@/request/index'
import { ref } from 'vue'
import type { ArticleType, CategoryType } from '@/stores/article/type'
import type { IAnyObj } from '@/request/http'
// import { ElMessage } from 'element-plus'
import type { ArticleList } from '@/request/path/articles'
import { ElMessage } from 'element-plus'
import type { mdArticleType } from '@/pages/article/operate.vue'

export const useArticleStore = defineStore(
  'article',
  () => {
    const articleInfo = ref({
      loading: false,
      articles: [] as ArticleType[],
      categories: [] as CategoryType[],
      meta: {
        page: 1,
        per_page: 10,
        total: 0,
      },
    })

    // 文章列表
    async function getArticles(
      params: Record<string, string> = {},
      fun?: (data: unknown) => void,
    ) {
      try {
        if (params.category == 'all') {
          params.category = ''
        }
        const page = +params.page || 1
        if (page === 1) {
          articleInfo.value.loading = true
        }
        const res = await api.getArticlesList(params)

        const [err, data] = res

        if (!err && data) {
          if (data?.data) {
            const { data: articlesListData } = data
            const { meta, data: rawArticles } = articlesListData

            const normalizeArticle = (
              r: Record<string, unknown>,
            ): ArticleType => ({
              ...(r as unknown as ArticleType),
              _id: String(r.id),
              praises: (r.praise_num as number) ?? 0,
              comments: (r.comment_num as number) ?? 0,
              is_praise: false,
              user: {
                ...((r.author as Record<string, unknown>) ?? {}),
                _id: String((r.author as Record<string, unknown>)?.id ?? ''),
              } as unknown as ArticleType['user'],
            })
            const articles = (
              rawArticles as unknown as Record<string, unknown>[]
            ).map(normalizeArticle)

            articleInfo.value.articles =
              page === 1
                ? articles
                : articleInfo.value.articles.concat(articles)

            articleInfo.value.meta = meta as typeof articleInfo.value.meta

            if (fun) {
              fun({
                ...articlesListData,
                data: articles,
              } as unknown as ArticleList)
            }

            articleInfo.value.loading = false
          }
        }
      } catch (error) {
        articleInfo.value.loading = false
        ElMessage.error('获取文章列表失败' + error)
      }
    }

    // 文章详情
    async function getArticlesDetail(
      id: string,
      fun: (data: ArticleType) => void,
    ) {
      try {
        const res = await api.getArticlesDetail(id)
        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            const raw = data.data as unknown as Record<string, unknown>
            const normalized: ArticleType = {
              ...(raw as unknown as ArticleType),
              _id: String(raw.id),
              created_by: String(raw.created_by),
              praises: (raw.praise_num as number) ?? 0,
              stars: (raw.star_num as number) ?? 0,
              comments: (raw.comment_num as number) ?? 0,
              is_praise: !!raw.is_praise,
              is_start: !!raw.is_start,
              user: {
                ...((raw.author as Record<string, unknown>) ?? {}),
                _id: String((raw.author as Record<string, unknown>)?.id ?? ''),
              } as unknown as ArticleType['user'],
            }
            if (fun) {
              fun(normalized)
            }
          }
        }
      } catch (error) {
        ElMessage.error('获取文章详情失败' + error)
      }
    }

    // 文章分类
    async function getCategory() {
      try {
        const res = await api.getCategory()
        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            const { data: categoryData } = data
            articleInfo.value.categories = categoryData
          }
        }
      } catch (error) {
        ElMessage.error('获取文章分类失败' + error)
      }
    }

    function getCateLabel(key: string) {
      const one = articleInfo.value.categories.find(row => row.key == key)
      return one ? one.label : null
    }

    // 操作点赞/收藏
    async function togglePraise(
      dataParams: IAnyObj,
      fun?: (data: unknown) => void,
    ) {
      try {
        const res = await api.togglePraise(dataParams)

        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            const { data: praiseData } = data
            if (fun) {
              fun(praiseData.action == 'praised' ? true : false)
            }
          }
        }
      } catch (error) {
        ElMessage.error('操作失败' + error)
      }
    }

    // 创建文章

    async function createArticle(
      dataParams: Partial<ArticleType>,
      fun: (data: mdArticleType) => void,
    ) {
      try {
        const res = await api.createArticle(dataParams)
        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            const { data: articlesData } = data
            const raw = articlesData as unknown as Record<string, unknown>
            fun({ ...(raw as unknown as mdArticleType), _id: String(raw.id) })
          }
        }
      } catch (error) {
        ElMessage.error('创建文章失败' + error)
      }
    }

    // 修改文章
    async function updateArticle(
      id: string,
      dataParams: Partial<ArticleType>,
      fun: () => void,
    ) {
      try {
        const res = await api.updateArticle(id, dataParams)
        const [err, data] = res
        if (!err && data) {
          if (data?.data) {
            // const { data: articlesData } = data
            fun()
          }
        }
      } catch (error) {
        ElMessage.error('修改文章失败' + error)
      }
    }

    // 发布文章
    async function publishArticle(id: string, fun: () => void) {
      try {
        await api.publishArticle(id)
        fun()
      } catch (error) {
        ElMessage.error('发布文章失败' + error)
      }
    }

    // 删除文章
    async function deleteArticle(id: string, fun: () => void) {
      try {
        await api.deleteArticle(id)
        fun()
      } catch (error) {
        ElMessage.error('删除文章失败' + error)
      }
    }

    return {
      articleInfo,
      getArticles,
      getArticlesDetail,
      getCategory,
      togglePraise,
      createArticle,
      updateArticle,
      publishArticle,
      deleteArticle,
      getCateLabel,
    }
  },
  {
    persist: true,
  },
)
