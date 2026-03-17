<template>
  <div class="workbench-page">
    <!-- 主标题区：与下方内容 30px 间距 -->
    <section class="page-banner">
      <!-- <i class="iconfont icon-shouye banner-icon"></i> -->
      <div class="banner-icon">
        <i class="iconfont icon-dunpai"></i>
      </div>
      <div class="banner-text">
        <h1 class="banner-title">AI 智能安全态势评估</h1>
        <p class="banner-subtitle">基于全网资产指纹与实时威胁情报的深度研判</p>
      </div>
    </section>

    <!-- 主内容区：左右 120px 边距，一屏内无纵向滚动，底部与输入框留 130px -->
	    <div class="main-content">
	      <div class="main-inner">
        <!-- 左侧主卡：React 风格 - 毛玻璃白 + 紫色描边 + 大圆角 -->
        <div class="left-card">
          <div class="card-blur-deco"></div>
          <div class="left-card-inner">
            <!-- 安全等级区：左侧等级与统计，右侧评分盒 -->
            <div class="section-security-level">
              <div class="security-level-left">
                <div class="security-level-label">当前安全等级</div>
                <p class="risk-grade">
                  <span class="grade-value">{{
                    securityOverview.currentSecurityLevel
                  }}</span>
                  <span class="grade-label"
                    >/ {{ securityOverview.riskDescription }}</span
                  >
                </p>
                <div class="stats-row">
                  <div class="stat-item">
                    <div class="stat-icon stat-icon--blue">
                      <i
                        class="iconfont icon-babiaoshebei"
                        style="font-size: 16px"
                      ></i>
                    </div>
                    <div class="stat-text">
                      <div class="stat-label">治理完成率</div>
                      <div class="stat-value">
                        {{ securityOverview.governanceCompletionRate }}%
                      </div>
                    </div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-icon stat-icon--orange">
                      <i
                        class="iconfont icon-zujianyuzhiyong"
                        style="font-size: 17px"
                      ></i>
                    </div>
                    <div class="stat-text">
                      <div class="stat-label">MTTR</div>
                      <div class="stat-value">
                        {{ securityOverview.mttrMinutes }}
                        {{ securityOverview.mttrMinutes > 1 ? 'm' : 's' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="security-score-box">
                <div class="score-label">
                  安全评分
                  <span
                    class="score-dot"
                    :style="{ background: scoreDotColor }"
                  ></span>
                </div>
                <div class="score-value">
                  {{ securityOverview.securityScore }}
                </div>
                <template v-if="securityOverview.daysSinceLastEval">
                  <div class="score-divider"></div>
                  <div class="score-meta-label">上次评估</div>
                  <div class="score-meta-value">
                    <i class="el-icon-time"></i>
                    {{ securityOverview.daysSinceLastEval }}
                  </div>
                </template>
              </div>
            </div>

            <!-- 三块内容：使用 securityOverview.text 数据，顺序为攻击面、风险评估、事件与基线 -->
            <div class="content-inner">
              <div class="section-card">
                <div class="section-icon-wrap">
                  <i class="iconfont icon-zujian" style="font-weight: 550"></i>
                </div>
                <div class="section-body">
                  <p
                    class="section-desc"
                    v-html="sectionContentHtml('attackSurface')"
                  ></p>
                </div>
              </div>
              <div class="section-card">
                <div class="section-icon-wrap">
                  <i class="iconfont icon-loudong1" style="font-size: 16px"></i>
                </div>
                <div class="section-body">
                  <p
                    class="section-desc"
                    v-html="sectionContentHtml('riskAssessment')"
                  ></p>
                </div>
              </div>
              <div class="section-card">
                <div class="section-icon-wrap">
                  <i
                    class="iconfont icon-xinhao"
                    style="font-size: 22px; font-weight: 500"
                  ></i>
                </div>
                <div class="section-body">
                  <p
                    class="section-desc"
                    v-html="sectionContentHtml('eventAndBaseline')"
                  ></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="right-card">
          <div class="ai-card">
            <div class="ai-card-bg-deco"></div>
            <div class="ai-card-inner">
              <div class="ai-card-header">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-sparkles w-4 h-4"
                  aria-hidden="true"
                >
                  <path
                    d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
                  ></path>
                  <path d="M20 2v4"></path>
                  <path d="M22 4h-4"></path>
                  <circle cx="4" cy="20" r="2"></circle>
                </svg>
                <span>AI 治理建议</span>
              </div>
              <h2 class="ai-card-title">立即执行高风险漏洞治理</h2>
              <p class="ai-card-desc">
                检测到2个 Critical 级别漏洞(Log4j2,
                Shiro)正处于互联网暴露状态。AI已生成自动化处置脚本,可一键完成虚拟补丁下发与端口收敛。
              </p>
              <el-button class="ai-card-btn"
                >立即执行治理 <i class="el-icon-arrow-right"></i
              ></el-button>
            </div>
          </div>
	        </aside>
	      </div>
	    </div>

	    <!-- 底部输入框：固定在底部，页面通过 padding-bottom 预留空间避免遮挡内容 -->
	    <div class="chat-input-wrap">
      <span class="chat-input-icon chat-input-add"
        ><el-icon><Plus /></el-icon></span>
      <input
        type="text"
        class="chat-input"
        placeholder="输入您想获得的信息，或想要执行的安全治理动作..."
      />
      <span class="chat-input-icon chat-input-send"
        ><el-icon><Promotion /></el-icon></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { securityOverviewTextAPI } from '@/api/workbench'

// ================= 数据 =================
const securityOverview = ref({})

// ================= 计算属性 =================
const scoreDotColor = computed(() => {
  const score = securityOverview.value.securityScore
  if (score == null || score === '') return '#94a3b8'
  const num = Math.max(0, Math.min(100, Number(score)))
  const hue = (num / 100) * 120
  return `hsl(${hue}, 70%, 45%)`
})

// ================= 生命周期 =================
onMounted(() => {
  getSecurityOverviewText()
})

// ================= 方法 =================
const getSecurityOverviewText = async () => {
  const { data } = await securityOverviewTextAPI()
  securityOverview.value = data
  console.log(securityOverview.value)
}

// HTML 转义
const escapeHtml = (str) => {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 生成 section HTML
const sectionContentHtml = (key) => {
  const textObj = securityOverview.value.text || {}
  const raw = textObj[key]

  if (!raw || typeof raw !== 'string') {
    const fallback = {
      attackSurface: '攻击面治理',
      riskAssessment: '风险评估',
      eventAndBaseline: '事件与基线'
    }
    return `<span class="section-desc-title">${
      fallback[key] || ''
    }</span>暂无数据`
  }

  const colonIndex = raw.indexOf('：')
  const title = colonIndex >= 0 ? raw.slice(0, colonIndex) : ''
  let body = colonIndex >= 0 ? raw.slice(colonIndex + 1) : raw

  body = escapeHtml(body)

  const tagMap = [
    { label: '弱口令', type: 'orange' },
    { label: '关键漏洞', type: 'red' },
    { label: '漏洞利用风险', type: 'red', display: '漏洞利用行为' },
    { label: '新增资产发现', type: 'blue' },
    { label: '基线偏离', type: 'orange' }
  ]

  for (const item of tagMap) {
    const { label, type, display } = item
    if (!body.includes(label)) continue

    const tagText =
      display != null ? escapeHtml(display) : escapeHtml(label)

    const span = `<span class="tag-inline tag--${type}">${tagText}</span>`
    body = body.split(label).join(span)
  }

  const titleHtml = title
    ? `<span class="section-desc-title">${escapeHtml(title)}</span>`
    : ''

  return titleHtml + body
}
</script>

<style lang="scss" scoped>
/* React Workbench 风格变量（对应 Tailwind） */
$primary: #9333ea;
$primaryLight: #faf5ff;
$purple100: #f3e8ff;
$purple200: #e9d5ff;
$red: #ef4444;
$rose: #f43f5e;
$white: #ffffff;
$zinc400: #a1a1aa;
$zinc500: #71717a;
$zinc900: #18181b;
$zinc100: #f4f4f5;

/* Layout: allow the page to grow and let the app container scroll on smaller windows. */
.workbench-page {
  --wb-chatbar-h: 72px;
  --wb-chatbar-bottom: clamp(16px, 4vh, 40px);

  width: 100%;
  min-height: 100%;
  padding: clamp(24px, 3.2vw, 40px) clamp(24px, 8vw, 160px) 0;
  /* Reserve space for the fixed bottom input so content never gets covered. */
  padding-bottom: calc(var(--wb-chatbar-h) + var(--wb-chatbar-bottom) + 24px);
  background: linear-gradient(180deg, #faf5ff 0%, #ffffff 50%, #ffffff 100%);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.page-banner {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0;
  margin-bottom: 32px;
  .banner-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: $white;
    background: $primary;
    border-radius: 12px;
    flex-shrink: 0;
    box-shadow: 0 10px 15px -3px rgba(147, 51, 234, 0.2);
    .iconfont {
      font-size: 22px;
      font-weight: 600;
    }
  }
  .banner-text {
    flex: 1;
    min-width: 0;
  }
  .banner-title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 700;
    color: $zinc900;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }
  .banner-subtitle {
    margin: 0;
    font-size: 13px;
    color: $zinc500;
    line-height: 1.4;
  }
}

/* 主内容：仅占“除去上下边距后”的剩余高度，保证无纵向滚动 */
.main-content {
	  flex: 1;
	  min-height: 0;
	  display: flex;
	  flex-direction: column;
	  overflow: visible;
	}

/* main-inner = 剩余高度 - spacer，两列自适应高度，不压住底部输入框 */
.main-inner {
	  flex: 1;
	  min-height: 0;
	  display: flex;
	  flex-wrap: nowrap;
	  gap: 20px;
	  align-items: stretch;
	  overflow: visible;
	}

/* Below this width, force the two cards to stack (each takes a full row). */
@media (max-width: 1100px) {
  .main-inner {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  .right-card {
    max-width: none;
    min-width: 0;
  }
}

/* 左侧主卡：高度自适应，小屏通过缩小字体与间距实现内容自适应，无滚动条 */
.left-card {
	  flex: 1 1 720px;
	  min-width: 0;
	  min-height: 0;
	  max-width: none;
	  position: relative;
	  background: rgba(255, 255, 255, 0.4);
	  backdrop-filter: blur(12px);
	  -webkit-backdrop-filter: blur(12px);
	  border: 1px solid $purple100;
	  border-radius: clamp(16px, 2.6vw, 40px);
	  padding: clamp(14px, 2.2vw, 32px);
	  box-shadow: 0 25px 50px -12px rgba(147, 51, 234, 0.05);
	  overflow: hidden;
	}

.card-blur-deco {
  position: absolute;
  top: -96px;
  right: -96px;
  width: 256px;
  height: 256px;
  background: rgba(233, 213, 255, 0.2);
  border-radius: 50%;
  filter: blur(48px);
  pointer-events: none;
}

.left-card-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

.section-security-level {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-shrink: 0;
}

.security-level-left {
  flex: 1;
  min-width: 0;
}

.security-level-label {
  font-size: 14px;
  font-weight: 700;
  color: $primary;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
@media (max-width: 1200px) {
  .left-card .security-level-label {
    font-size: 12px;
    margin-bottom: 2px;
  }
}
@media (max-width: 768px) {
  .left-card .security-level-label {
    font-size: 11px;
  }
}

.risk-grade {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 900;
  color: $zinc900;
  line-height: 1.2;
  .grade-value {
    font-weight: 900;
  }
  .grade-label {
    font-size: 14px;
    font-weight: 500;
    color: $zinc400;
    margin-left: 4px;
  }
}
@media (max-width: 1200px) {
  .left-card .risk-grade {
    margin: 0 0 8px;
    font-size: 20px;
    .grade-label {
      font-size: 12px;
    }
  }
}
@media (max-width: 768px) {
  .left-card .risk-grade {
    margin: 0 0 6px;
    font-size: 17px;
    .grade-label {
      font-size: 11px;
    }
  }
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-top: 8px;
}
@media (max-width: 1200px) {
  .left-card .stats-row {
    gap: 16px;
    padding-top: 4px;
  }
}
@media (max-width: 768px) {
  .left-card .stats-row {
    gap: 12px;
    padding-top: 2px;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 768px) {
  .left-card .stat-item {
    gap: 6px;
  }
}

.stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  &--blue {
    background: #eff6ff;
    color: #2563eb;
  }
  &--orange {
    background: #fff7ed;
    color: #ea580c;
  }
}
@media (max-width: 1200px) {
  .left-card .stat-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    font-size: 12px;
  }
}
@media (max-width: 768px) {
  .left-card .stat-icon {
    width: 22px;
    height: 22px;
    font-size: 11px;
  }
}

.stat-label {
  font-size: 12px;
  font-weight: 700;
  color: $zinc400;
  text-transform: uppercase;
}

.stat-value {
  font-size: 13px;
  font-weight: 900;
  color: $zinc900;
}
@media (max-width: 1200px) {
  .left-card .stat-label,
  .left-card .stat-value {
    font-size: 11px;
  }
}
@media (max-width: 768px) {
  .left-card .stat-label,
  .left-card .stat-value {
    font-size: 10px;
  }
}

.security-score-box {
  flex-shrink: 0;
  min-width: 140px;
  text-align: center;
  padding: 16px 24px;
  background: $white;
  border-radius: 24px;
  border: 1px solid $zinc100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
@media (max-width: 1200px) {
  .left-card .security-score-box {
    min-width: 110px;
    padding: 12px 16px;
    border-radius: 16px;
  }
}
@media (max-width: 768px) {
  .left-card .security-score-box {
    min-width: 90px;
    padding: 8px 12px;
    border-radius: 12px;
  }
}

.score-label {
  font-size: 12px;
  font-weight: 700;
  color: $zinc400;
  text-transform: uppercase;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.score-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.score-value {
  font-size: 24px;
  font-weight: 900;
  color: $primary;
}
@media (max-width: 1200px) {
  .left-card .score-label,
  .left-card .score-meta-label,
  .left-card .score-meta-value {
    font-size: 10px;
  }
  .left-card .score-value {
    font-size: 20px;
  }
}
@media (max-width: 768px) {
  .left-card .score-label,
  .left-card .score-meta-label,
  .left-card .score-meta-value {
    font-size: 9px;
  }
  .left-card .score-value {
    font-size: 16px;
  }
}

.score-divider {
  margin: 8px 0;
  border-top: 1px solid $zinc100;
}
@media (max-width: 1200px) {
  .left-card .score-divider {
    margin: 4px 0;
  }
}
@media (max-width: 768px) {
  .left-card .score-divider {
    margin: 2px 0;
  }
}

.score-meta-label {
  font-size: 12px;
  font-weight: 700;
  color: $zinc400;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.score-meta-value {
  font-size: 12px;
  font-weight: 700;
  color: $primary;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: $primaryLight;
  padding: 2px 8px;
  border-radius: 999px;
}

.content-inner {
	  padding: 24px;
	  background: rgba(255, 255, 255, 0.6);
	  border-radius: 24px;
	  border: 1px solid rgba(255, 255, 255, 0.8);
	  display: flex;
	  flex-direction: column;
	  gap: 32px;
	  flex: 1;
	  min-height: 0;
	  overflow: auto;
	}
@media (max-width: 1200px) {
  .left-card .content-inner {
    padding: 18px;
    border-radius: 18px;
    gap: 20px;
  }
}
@media (max-width: 768px) {
  .left-card .content-inner {
    padding: 10px;
    border-radius: 12px;
    gap: 10px;
  }
}

.section-card {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-shrink: 0;
}
@media (max-width: 1200px) {
  .left-card .section-card {
    gap: 12px;
  }
}
@media (max-width: 768px) {
  .left-card .section-card {
    gap: 8px;
  }
}

.section-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: $primaryLight;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--default-color);
}
@media (max-width: 1200px) {
  .left-card .section-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }
}
@media (max-width: 768px) {
  .left-card .section-icon-wrap {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }
}

.section-icon {
  font-size: 16px;
  color: $primary;
}

.section-body {
  flex: 1;
  min-width: 0;
}

/* 攻击面治理 / 风险评估 / 事件与基线：标题在描述上一行，16px 加粗 */
.section-desc-title {
  display: block;
  font-weight: 700;
  color: $zinc900;
  font-size: 16px;
  margin-bottom: 4px;
}
@media (max-width: 1200px) {
  .left-card .section-desc-title {
    font-size: 15px;
    margin-bottom: 2px;
  }
}
@media (max-width: 768px) {
  .left-card .section-desc-title {
    font-size: 14px;
    margin-bottom: 2px;
  }
}

.section-desc {
  margin: 0;
  font-size: 13px;
  color: #3f3f46;
  line-height: 1.7;
}
@media (max-width: 1200px) {
  .left-card .section-desc {
    font-size: 12px;
    line-height: 1.55;
  }
}
@media (max-width: 768px) {
  .left-card .section-desc {
    font-size: 10px;
    line-height: 1.45;
  }
}

.tag-inline {
  display: inline;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid;
  margin: 0 2px;
}
@media (max-width: 1200px) {
  .left-card .tag-inline {
    padding: 1px 6px;
    font-size: 11px;
  }
}
@media (max-width: 768px) {
  .left-card .tag-inline {
    padding: 1px 4px;
    font-size: 10px;
  }
}

.tag--red {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fecaca;
}

.tag--orange {
  background: #ffedd5;
  color: #c2410c;
  border-color: #fed7aa;
}

.tag--blue {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

/* v-html 内标题与标签需用深度选择器才能应用 scoped 样式 */
.section-desc :deep(.section-desc-title) {
  display: block;
  font-weight: 700;
  color: #18181b;
  font-size: 16px;
  margin-bottom: 4px;
}

.section-desc :deep(.tag-inline) {
  display: inline;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid;
  margin: 0 2px;
}

.section-desc :deep(.tag--red) {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fecaca;
}

.section-desc :deep(.tag--orange) {
  background: #ffedd5;
  color: #c2410c;
  border-color: #fed7aa;
}

.section-desc :deep(.tag--blue) {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.tag--purple {
  background: #f3e8ff;
  color: #9810fa;
  border-color: #e9d5ff;
}

/* 左侧主卡小屏：统一缩小间距，允许内容区收缩 */
@media (max-width: 1200px) {
  .left-card .left-card-inner {
    gap: 18px;
  }
  .left-card .section-security-level {
    gap: 16px;
  }
}
@media (max-width: 768px) {
  .left-card .left-card-inner {
    gap: 10px;
  }
  .left-card .section-security-level {
    gap: 10px;
  }
}


/* 右侧：自适应高度，与左侧同高，不压住底部输入框 */
.right-card {
	  flex: 0 1 360px;
	  width: auto;
	  min-width: 280px;
    max-width: 460px;
	  min-height: 0;
	  flex-shrink: 0;
	  display: flex;
	  flex-direction: column;
	  overflow: hidden;
	}

.ai-card {
  position: relative;
  flex: 1;
  min-height: 0;
  background: linear-gradient(135deg, #ef4444 0%, #bf0021 100%);
  border-radius: 40px;
  padding: 32px;
  box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  &:hover {
    .ai-card-bg-deco {
      transform: scale(1.1);
      transition: transform 0.3s ease;
    }
  }

  .ai-card-bg-deco {
    position: absolute;
    top: 20px;
    right: 30px;
    width: 160px;
    height: 160px;
    padding: 32px;
    opacity: 0.1;
    pointer-events: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' stroke='white' stroke-width='2'%3E%3Cpath d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/%3E%3C/svg%3E")
      no-repeat center;
    background-size: 80%;
  }
  .ai-card-inner {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
  }
  .ai-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    .ai-card-star {
      font-size: 14px;
      color: $white;
    }
  }
  .ai-card-title {
    margin: 0 0 10px;
    font-size: 20px;
    font-weight: 900;
    color: $white;
    line-height: 1.25;
    flex: 0 0 auto;
  }
  .ai-card-desc {
    margin: 0 0 16px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    line-height: 2;
    flex: 1;
    min-height: 0;
  }
  .ai-card-btn {
    width: 100%;
    height: 56px;
    background: $white !important;
    border: none !important;
    color: $red !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    border-radius: 16px !important;
    margin-top: auto;
    flex-shrink: 0;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    i {
      transition: transform 0.2s;
    }
    &:hover {
      background: #fef2f2 !important;
      i {
        transform: translateX(4px);
      }
    }
  }
}

/* 底部输入框：React 风格 - 毛玻璃、紫色描边、居中 */
.chat-input-wrap {
	  position: fixed;
	  bottom: var(--wb-chatbar-bottom);
	  left: 50%;
	  transform: translateX(-50%);
	  width: min(896px, calc(100% - 32px));
	  max-width: 896px;
	  z-index: 100;
	  display: flex;
	  align-items: center;
	  gap: 8px;
	  padding: 8px 8px 8px 16px;
    min-height: var(--wb-chatbar-h);
	  background: rgba(255, 255, 255, 0.9);
	  backdrop-filter: blur(24px);
	  -webkit-backdrop-filter: blur(24px);
	  border: 1px solid $purple100;
	  border-radius: 24px;
	  box-shadow: 0 20px 50px rgba(147, 51, 234, 0.15);
	  @media (max-width: 768px) {
	    width: calc(100% - 24px);
	  }
	  .chat-input-icon {
	    width: 40px;
	    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 16px;
    flex-shrink: 0;
  }
  .chat-input-add {
    background: transparent;
    color: $zinc400;
  }
  .chat-input-send {
    background: $primary;
    color: $white;
    border: none;
    cursor: pointer;
    border-radius: 11px;
    padding: 0;
    font-size: 23px;
    &:hover {
      background: #9810fa;
    }
  }
  .chat-input {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 12px;
    border: none;
    background: transparent;
    font-size: 13px;
    color: $zinc900;
    outline: none;
    &::placeholder {
      color: $zinc400;
    }
  }
}
</style>
