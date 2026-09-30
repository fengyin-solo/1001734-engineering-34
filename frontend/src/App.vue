<template>
  <div v-if="!cfg.config" class="config-error" role="alert">
    <h2>前端配置缺失，无法启动</h2>
    <p>请补齐下列配置后点击“重新加载”。当前不会使用任何旧值。</p>
    <ul>
      <li v-for="(issue, index) in cfg.issues" :key="issue.key + index" class="config-error-line">
        <span v-if="issue.line" class="config-error-where">.env 第 {{ issue.line }} 行：</span>
        {{ issue.reason }}
      </li>
    </ul>
    <button class="btn primary" type="button" @click="retry">重新加载配置</button>
  </div>
  <div v-else class="app-shell">
    <aside class="app-side">
      <h1 class="app-title">{{ cfg.config.appName }}</h1>
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
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useSessionStore } from '@/stores/session'
import { buildNavItems } from '@/config/app'
import { useAppConfig } from '@/config/runtime'

const store = useSessionStore()
const { state: cfg, retry } = useAppConfig()

// 导航项由唯一模块清单派生，反复初始化返回同一份，不会出现重复项。
const navItems = buildNavItems()
</script>
