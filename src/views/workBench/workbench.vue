<template>
  <div class="page">
    <el-card class="card ai">
      <template #header>
        <div class="ai-header">
          <div class="ai-title">
            <span class="ai-icon">
              <el-icon><MagicStick /></el-icon>
            </span>
            <div class="ai-text">
              <div class="h">AI 智能分析</div>
              <div class="p">输入关键词或问题，AI 将为您分析网络安全风险</div>
            </div>
          </div>
        </div>
      </template>

      <div class="ai-body">
        <div class="ai-search">
          <el-input
            v-model="searchQuery"
            placeholder="例如：输入 IP 地址、漏洞名称 或 点击下方标签快速分析..."
            size="large"
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button class="analyze" type="primary" size="large">
            <el-icon><MagicStick /></el-icon>
            智能分析
          </el-button>
        </div>

        <div class="chips">
          <el-tag v-for="(chip, idx) in chips" :key="idx" effect="plain" round class="chip">
            {{ chip }}
          </el-tag>
        </div>
      </div>
    </el-card>

    <div class="section-row">
      <div class="section-title">
        <span class="dot" />
        攻击面治理概览
      </div>
      <div class="section-actions">
        <el-button text class="link">查看详情</el-button>
        <div class="slash">/</div>
        <el-button text class="link">
          <el-icon><Lightning /></el-icon>
          威胁评估与事件
        </el-button>
      </div>
    </div>

    <div class="grid-top">
      <el-card class="card metric">
        <div class="metric-head">
          <div class="k">关键漏洞</div>
          <div class="badge danger">+2</div>
        </div>
        <div class="metric-val">12</div>
        <div class="bars">
          <span v-for="n in 5" :key="n" class="bar" :style="{ height: `${18 + n * 10}%` }" />
        </div>
      </el-card>

      <el-card class="card metric">
        <div class="metric-head">
          <div class="k">高危端口</div>
          <div class="badge success">-1</div>
        </div>
        <div class="metric-val">8</div>
        <svg class="line" viewBox="0 0 240 70" preserveAspectRatio="none">
          <path d="M0,40 C50,52 70,30 110,38 C150,46 170,34 240,40" />
        </svg>
      </el-card>

      <el-card class="card metric">
        <div class="metric-head">
          <div class="k">策略问题</div>
          <div class="badge danger">+5</div>
        </div>
        <div class="metric-val">24</div>
        <div class="metric-sub">资产/租户口碑波动影响</div>
      </el-card>

      <el-card class="card stats">
        <div class="stats-head">
          <div class="h">威胁处置统计</div>
          <el-tag effect="plain" type="danger" size="small" round>高风险</el-tag>
        </div>
        <div class="stats-2">
          <div class="mini">
            <div class="mk">利用行为</div>
            <div class="mv">14</div>
          </div>
          <div class="mini">
            <div class="mk">扫描行为</div>
            <div class="mv">128</div>
          </div>
        </div>
        <div class="stats-list">
          <div class="row">
            <div class="rk">封禁恶意 IP 数</div>
            <div class="rv">42</div>
          </div>
          <div class="row">
            <div class="rk">收敛攻击目标</div>
            <div class="rv">8</div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="grid-bottom">
      <el-card class="card panel">
        <template #header>
          <div class="panel-head">漏洞分布分析</div>
        </template>
        <div class="donut">
          <div class="ring" />
          <div class="legend">
            <div class="li"><span class="c c1" />端口</div>
            <div class="li"><span class="c c2" />漏洞</div>
            <div class="li"><span class="c c3" />策略</div>
          </div>
        </div>
      </el-card>

      <el-card class="card panel">
        <template #header>
          <div class="panel-head">暴露面信息补全</div>
        </template>
        <div class="fill">
          <div class="desc">当前归因到域名出口与站点收敛进度</div>
          <div class="progress-row">
            <div class="label">补全进度</div>
            <div class="value">65%</div>
          </div>
          <div class="progress">
            <div class="progress-inner" style="width: 65%" />
          </div>
          <el-button class="full" type="primary" plain>立即获取互联网网站地址</el-button>
        </div>
      </el-card>

      <div class="right-stack">
        <el-card class="card panel">
          <template #header>
            <div class="panel-head row-between">
              <span>资产/基线变动</span>
              <span class="muted">最近 24 小时</span>
            </div>
          </template>
          <div class="activity">
            <div class="act">
              <div class="act-left">
                <span class="act-icon plus">+</span>
                <div class="act-text">
                  <div class="t">新增资产/端口</div>
                  <div class="s">合并到 5 个新资产</div>
                </div>
              </div>
              <div class="act-right up">+5</div>
            </div>
            <div class="act">
              <div class="act-left">
                <span class="act-icon warn">!</span>
                <div class="act-text">
                  <div class="t">基线偏离事件</div>
                  <div class="s">发现 3 处变动异常</div>
                </div>
              </div>
              <div class="act-right down">3</div>
            </div>
          </div>
          <el-button class="enter" type="primary">进入事件响应中心</el-button>
        </el-card>

        <el-card class="card panel small">
          <div class="remind">
            <div>
              <div class="panel-head">重新评估提醒</div>
              <div class="muted">建议优先 7 天内新增的高危扫描</div>
            </div>
            <el-button class="refresh" type="primary" circle>
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Lightning, MagicStick, Refresh, Search } from '@element-plus/icons-vue'

const searchQuery = ref('')
const chips = [
  '未封禁资产',
  '高风险资产',
  '待收敛的高危端口',
  '暴露面资产',
  '关键漏洞',
  '两端 - 弱',
  '全部资产分析',
  '全部风险分析',
  '全部待处置漏洞分析',
  '热点（关键）漏洞'
]
</script>

<style scoped>
.page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.card {
  border-radius: 14px;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow);
}

.ai :deep(.el-card__header) {
  padding: 18px 18px 10px;
  border-bottom: none;
}

.ai :deep(.el-card__body) {
  padding: 0 18px 18px;
}

.ai-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--app-purple);
  background: var(--app-purple-soft);
}

.ai-text .h {
  font-weight: 700;
  color: var(--app-text);
}

.ai-text .p {
  margin-top: 2px;
  font-size: 12px;
  color: var(--app-muted);
}

.ai-search {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 14px;
  align-items: center;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 14px;
  box-shadow: none;
  border: 1px solid var(--app-border);
  background: #fff;
}

.analyze {
  border-radius: 14px;
  height: 44px;
  box-shadow: 0 10px 22px rgba(124, 58, 237, 0.22);
}

.chips {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  border-radius: 999px;
  color: var(--app-muted);
  background: #fff;
  border: 1px solid var(--app-border);
}

.section-row {
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--app-text);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--app-purple);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--app-muted);
}

.link {
  color: var(--app-purple);
}

.slash {
  color: var(--app-border);
}

.grid-top {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1.4fr;
  gap: 18px;
}

.metric :deep(.el-card__body) {
  padding: 16px 16px 14px;
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.k {
  font-size: 12px;
  color: var(--app-muted);
}

.badge {
  height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
}

.badge.danger {
  color: #ff3b6b;
  background: #fff1f5;
}

.badge.success {
  color: #16a34a;
  background: #ecfdf3;
}

.metric-val {
  margin-top: 6px;
  font-size: 30px;
  font-weight: 800;
  color: var(--app-text);
}

.bars {
  margin-top: 14px;
  height: 48px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.bar {
  width: 40px;
  border-radius: 6px 6px 0 0;
  background: var(--app-purple);
  opacity: 0.9;
}

.line {
  margin-top: 16px;
  width: 100%;
  height: 52px;
}

.line path {
  fill: none;
  stroke: var(--app-purple);
  stroke-width: 3;
}

.metric-sub {
  margin-top: 10px;
  font-size: 12px;
  color: var(--app-muted);
}

.stats :deep(.el-card__body) {
  padding: 16px;
}

.stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats-head .h {
  font-weight: 700;
  color: var(--app-text);
}

.stats-2 {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.mini {
  padding: 12px 12px 10px;
  border-radius: 14px;
  border: 1px solid var(--app-border);
  background: var(--app-muted-bg);
}

.mk {
  font-size: 12px;
  color: var(--app-muted);
}

.mv {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 800;
  color: var(--app-text);
}

.stats-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--app-muted);
}

.rv {
  font-weight: 700;
  color: var(--app-text);
}

.grid-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr 1.1fr;
  gap: 18px;
}

.panel :deep(.el-card__header) {
  padding: 16px;
}

.panel :deep(.el-card__body) {
  padding: 16px;
}

.panel-head {
  font-weight: 700;
  color: var(--app-text);
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.donut {
  height: 240px;
  display: grid;
  grid-template-columns: 1fr;
  place-items: center;
  gap: 12px;
}

.ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(var(--app-purple) 0 45%, #a78bfa 45% 75%, #e9d5ff 75% 100%);
  -webkit-mask: radial-gradient(circle 42px at center, transparent 98%, #000 100%);
  mask: radial-gradient(circle 42px at center, transparent 98%, #000 100%);
}

.legend {
  display: flex;
  gap: 14px;
  color: var(--app-muted);
  font-size: 12px;
}

.li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.c {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.c1 {
  background: var(--app-purple);
}
.c2 {
  background: #a78bfa;
}
.c3 {
  background: #e9d5ff;
}

.fill .desc {
  font-size: 12px;
  color: var(--app-muted);
  margin-bottom: 14px;
}

.progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--app-muted);
}

.progress {
  margin-top: 10px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-muted-bg);
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  border-radius: 999px;
  background: var(--app-purple);
}

.full {
  margin-top: 14px;
  width: 100%;
  border-radius: 14px;
  background: var(--app-purple-soft);
  border-color: transparent;
  color: var(--app-purple);
}

.right-stack {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 18px;
}

.muted {
  color: var(--app-muted);
  font-size: 12px;
}

.activity {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.act {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.act-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.act-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.act-icon.plus {
  color: var(--app-purple);
  background: var(--app-purple-soft);
}

.act-icon.warn {
  color: #ef4444;
  background: #fff1f2;
}

.act-text .t {
  font-weight: 700;
  color: var(--app-text);
  font-size: 13px;
}

.act-text .s {
  margin-top: 2px;
  font-size: 12px;
  color: var(--app-muted);
}

.act-right {
  font-weight: 800;
  font-size: 13px;
}

.act-right.up {
  color: var(--app-purple);
}

.act-right.down {
  color: #ef4444;
}

.enter {
  margin-top: 14px;
  width: 100%;
  border-radius: 14px;
  background: #0f172a;
  border-color: #0f172a;
}

.small :deep(.el-card__body) {
  padding: 16px;
}

.remind {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.refresh {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  box-shadow: 0 10px 22px rgba(124, 58, 237, 0.22);
}

@media (max-width: 1200px) {
  .grid-top {
    grid-template-columns: 1fr 1fr;
  }
  .grid-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
