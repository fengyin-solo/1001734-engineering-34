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
        <tr v-for="row in moduleRows" :key="row.name">
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
import { MODULES, emptyModuleRows } from '@/config/app'

type Overview = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
}

const cards = ref<Overview['cards']>([])
const moduleRows = ref<Overview['modules']>([])

onMounted(async () => {
  try {
    const payload = await fetchJson<Overview>('/overview')
    cards.value = payload.cards
    // 以唯一模块清单为准对齐服务端数据：缺失的模块补 0，保证数量与左侧导航一致。
    const byName = new Map(payload.modules.map((row) => [row.name, row]))
    moduleRows.value = MODULES.map(
      (mod) =>
        byName.get(mod.label) ?? {
          name: mod.label,
          created: 0,
          pending: 0,
          abnormal: 0,
        },
    )
  } catch {
    cards.value = [{ label: '业务模块', value: MODULES.length }, { label: '今日新增', value: 0 }]
    moduleRows.value = emptyModuleRows()
  }
})
</script>
