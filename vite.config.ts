import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist', // 确保输出目录正确
  },
  server: {
    proxy: {
      '/api2': {
        target: 'http://localhost:3007', // 开发环境配置
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api2/, ''),
      },
    },
  },
})
