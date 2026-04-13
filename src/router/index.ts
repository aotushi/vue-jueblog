import { createRouter, createWebHistory } from 'vue-router'
import routes from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(to => {
  if (to.meta.requiresAuth && !localStorage.getItem('jueblog_token')) {
    import('@/stores').then(({ useUserStore }) => {
      useUserStore().showLogin()
    })
    return false
  }
})

export default router
