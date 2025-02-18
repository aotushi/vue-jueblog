<template>
  <div class="header-search">
    <el-input
      v-model="text"
      ref="dom"
      placeholder="搜索文章/用户"
      :style="{ width: is_focus ? '320px' : '250px' }"
      @focus="onFocus"
      @blur="onBlur"
      @keyup.enter="toSearch"
    >
      <template #suffix>
        <el-icon :size="16">
          <Search />
        </el-icon>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
// import { useRouter } from 'vue-router'
const text = ref('')
const is_focus = ref(false)
const dom = ref<HTMLElement | null>(null)
// const router = useRouter()

const onFocus = () => {
  is_focus.value = true
}
const onBlur = () => {
  is_focus.value = false
}
const toSearch = () => {
  if (!dom.value) return
  dom.value.blur()
  // router.push('/search?text=' + text.value)
}
</script>

<style lang="less">
.header-search {
  .el-input {
    transition: all 0.2s;
  }
}
</style>
