<template>
  <div v-if="!state.config" class="config-gate">
    <h2 class="config-title">前端配置缺失，页面无法启动</h2>
    <p class="config-desc">{{ state.error?.message ?? '配置尚未初始化' }}</p>
    <ul v-if="state.error?.missingKeys.length" class="config-keys">
      <li v-for="key in state.error.missingKeys" :key="key">{{ key }}</li>
    </ul>
    <p class="config-hint">请在 <code>frontend/.env</code> 中补齐以上配置后点击重试。</p>
    <button class="btn primary" type="button" :disabled="retrying" @click="onRetry">
      {{ retrying ? '重试中…' : '重试' }}
    </button>
  </div>
  <div v-else class="app-shell">
    <aside class="app-side">
      <h1 class="app-title">{{ state.config.appName }}</h1>
      <nav class="nav-list">
        <RouterLink v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item">
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="app-main">
      <header class="app-head">
        <span class="head-desc">面向锅炉、压力容器、起重机械、电梯等特种设备的台账建档、日常点检、润滑保养、定期检验与隐患整改的一体化运维后台。</span>
        <span class="head-user">当前值班：{{ store.operator }} · {{ store.shiftLabel }}</span>
      </header>
      <p v-if="state.error" class="config-banner error-text">{{ state.error.message }}</p>
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { getNavItems } from '@/config/modules'
import { retryConfig, useConfig } from '@/config/runtime'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()
const { state } = useConfig()

// 导航项由统一登记表冻结缓存：重复初始化只复用，不会追加出重复项。
const navItems = getNavItems()

const retrying = ref(false)
async function onRetry() {
  retrying.value = true
  try {
    // 重试仍失败时保留旧值（state.config 不被覆盖），错误提示保持可见。
    await retryConfig()
  } catch {
    // 错误已写入 state.error，界面继续显示缺失项与重试入口。
  } finally {
    retrying.value = false
  }
}
</script>
