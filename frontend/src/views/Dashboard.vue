<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h2>运营概览</h2>
        <p class="page-desc">汇总各业务模块的关键指标，先看总量再看异常。</p>
      </div>
    </header>
    <div class="stat-row">
      <article v-for="card in cards" :key="card.label" class="stat-card">
        <span class="stat-label">{{ card.label }}</span>
        <strong class="stat-value">{{ card.value }}</strong>
      </article>
    </div>
    <table class="data-table">
      <thead>
        <tr><th>业务模块</th><th>今日新增</th><th>待处理</th><th>异常量</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in moduleRows" :key="row.key">
          <td>{{ row.name }}</td>
          <td>{{ row.created }}</td>
          <td>{{ row.pending }}</td>
          <td>{{ row.abnormal }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { fetchJson } from '@/api/client'
import { MODULES, getModuleCount } from '@/config/modules'

type Overview = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
}

type ModuleRow = { key: string; name: string; created: number; pending: number; abnormal: number }

const cards = ref<Overview['cards']>([])
// 模块行以统一登记表为骨架：左侧导航与本页模块数始终是同一份，
// 接口缺失或返回多/少模块都不改变行数与顺序。
const moduleRows = ref<ModuleRow[]>(
  MODULES.map((module) => ({
    key: module.key,
    name: module.label,
    created: 0,
    pending: 0,
    abnormal: 0,
  })),
)

function fallbackCards() {
  return [
    { label: '业务模块', value: getModuleCount() },
    { label: '今日新增', value: 0 },
    { label: '待处理', value: 0 },
    { label: '异常量', value: 0 },
  ]
}

onMounted(async () => {
  try {
    const payload = await fetchJson<Overview>('/overview')
    cards.value = payload.cards.length ? payload.cards : fallbackCards()
    const byKey = new Map(payload.modules.map((row) => [row.name, row]))
    moduleRows.value = MODULES.map((module) => {
      const remote = byKey.get(module.key)
      return {
        key: module.key,
        name: module.label,
        created: remote?.created ?? 0,
        pending: remote?.pending ?? 0,
        abnormal: remote?.abnormal ?? 0,
      }
    })
  } catch {
    cards.value = fallbackCards()
  }
})
</script>
