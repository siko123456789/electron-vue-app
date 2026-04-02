<template>
  <transition name="task-details-modal-fade">
    <div
      v-if="visible && modalType"
      class="task-modal-overlay"
      @click.self="closeModal"
    >
      <div :class="['task-modal', taskModalAccentClass]">
        <div class="task-modal-accent-bar" aria-hidden="true"></div>
        <div class="task-modal-header">
          <div class="task-modal-header-left">
            <div :class="['task-modal-icon', taskModalIconClass]">
              <el-icon><component :is="taskModalIconComponent" /></el-icon>
            </div>
            <div class="task-modal-header-text">
              <h3 class="task-modal-title">{{ taskModalTitle }}</h3>
              <p class="task-modal-meta">
                <span class="task-modal-count-badge">{{ total }}</span>
                <span class="task-modal-meta-label">条任务</span>
                <span v-if="loading" class="task-modal-meta-loading">加载中…</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            class="task-modal-close"
            title="关闭"
            @click="closeModal"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div
          v-loading="loading"
          element-loading-text="加载中..."
          element-loading-background="rgba(9, 9, 11, 0.78)"
          element-loading-custom-class="task-modal-loading"
          class="task-modal-body custom-scrollbar-task"
        >
          <div
            v-for="taskRow in taskList"
            :key="taskRow.id"
            class="task-modal-item"
          >
            <div class="task-modal-item-top">
              <h4 class="task-modal-item-title">{{ taskRow.title }}</h4>
              <div class="task-modal-item-top-right">
                <span class="task-modal-item-time">{{
                  formatTaskTime(taskRow)
                }}</span>
                <button
                  v-if="showExecuteButton"
                  type="button"
                  class="task-modal-item-execute"
                  :disabled="isRowExecuteDisabled(taskRow)"
                  @click="handleRowExecute(taskRow)"
                >
                  <el-icon
                    v-if="executingTaskId === taskRow.id"
                    class="is-loading"
                  >
                    <Loading />
                  </el-icon>
                  <el-icon v-else><Lightning /></el-icon>
                  执行
                </button>
              </div>
            </div>
            <div class="task-modal-item-chips">
              <span class="task-chip">
                <el-icon><Monitor /></el-icon>
                资产
                <strong>{{ taskRow.asset_ip || '—' }}</strong>
              </span>
              <span class="task-chip">
                <el-icon><Connection /></el-icon>
                端口
                <strong>{{
                  taskRow.port != null && taskRow.port !== ''
                    ? String(taskRow.port)
                    : '—'
                }}</strong>
              </span>
              <span class="task-chip task-chip--type">
                <el-icon><Tickets /></el-icon>
                {{ taskTypeLabel(taskRow.task_type) }}
              </span>
            </div>
            <div class="task-modal-item-detail">
              <div class="task-modal-item-detail-label">
                <el-icon><InfoFilled /></el-icon>
                详情
              </div>
              <p class="task-modal-item-detail-text">
                {{ taskRow.content || taskRow.title || '—' }}
              </p>
            </div>
          </div>
          <div v-if="!loading && taskList.length === 0" class="task-modal-empty">
            <div class="task-modal-empty-icon">
              <el-icon><Document /></el-icon>
            </div>
            <p class="task-modal-empty-title">暂无任务</p>
            <p class="task-modal-empty-desc">当前筛选条件下没有可展示的任务</p>
          </div>
          <div
            v-if="!loading && total > pageSize"
            class="task-modal-pagination-wrap"
          >
            <el-pagination
              small
              layout="prev, pager, next, total"
              :current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
// @ts-nocheck
import {
  CircleCheck,
  CircleClose,
  Close,
  Connection,
  Document,
  DocumentCopy,
  InfoFilled,
  Lightning,
  Loading,
  Monitor,
  Tickets
} from '@element-plus/icons-vue'
import { taskListNewAPI } from '@/api/aiGovernance'

/** 与待办 todo 接口一致：按分类分别请求后合并（见 task/todo/list） */
const TODO_CATEGORY_ORDER = ['关键漏洞', '弱口令', '高危端口']

/** task_type → 中文展示 */
const TASK_TYPE_LABEL_MAP = {
  critical_vuln_unfixed: '关键漏洞',
  weak_password: '弱口令',
  high_risk_port: '高危端口',
  weak_credential: '弱口令'
}

/** 弹框类型 → 接口 status：0 待执行 1 已执行 2 已挂起 */
function modalTypeToApiStatus (modalType) {
  const statusMap = {
    pending: 0,
    executed: 1,
    suspended: 2
  }
  return statusMap[modalType] !== undefined ? statusMap[modalType] : -1
}

export default {
  name: 'TaskDetailsPop',
  components: {
    CircleCheck,
    CircleClose,
    Close,
    Connection,
    Document,
    DocumentCopy,
    InfoFilled,
    Lightning,
    Loading,
    Monitor,
    Tickets
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    /** executed | suspended | pending */
    modalType: {
      type: String,
      default: null
    },
    /** 父组件在执行非关键漏洞任务时传入，用于行内 loading */
    executingTaskId: {
      type: [Number, String],
      default: null
    }
  },
  data () {
    return {
      loading: false,
      taskList: [],
      total: 0,
      currentPage: 1,
      pageSize: 10
    }
  },
  computed: {
    taskModalTitle () {
      const titleMap = {
        executed: '已执行的任务',
        suspended: '已挂起的任务',
        pending: '待执行的任务'
      }
      return titleMap[this.modalType] || ''
    },
    taskModalIconClass () {
      const map = {
        executed: 'task-card-icon--emerald',
        suspended: 'task-card-icon--amber',
        pending: 'task-card-icon--purple'
      }
      return map[this.modalType] || ''
    },
    taskModalIconComponent () {
      const map = {
        executed: CircleCheck,
        suspended: CircleClose,
        pending: DocumentCopy
      }
      return map[this.modalType] || Document
    },
    /** 仅「已挂起」「待执行」展示行内执行按钮 */
    showExecuteButton () {
      return this.modalType === 'suspended' || this.modalType === 'pending'
    },
    /** 顶栏强调色：与三类任务卡片语义一致 */
    taskModalAccentClass () {
      const map = {
        executed: 'task-modal--accent-emerald',
        suspended: 'task-modal--accent-amber',
        pending: 'task-modal--accent-violet'
      }
      return map[this.modalType] || ''
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler (value) {
        if (value && this.modalType) {
          this.currentPage = 1
          this.fetchTaskList()
        }
      }
    },
    modalType () {
      if (this.visible && this.modalType) {
        this.currentPage = 1
        this.fetchTaskList()
      }
    }
  },
  methods: {
    isRowExecuteDisabled (taskRow) {
      return this.executingTaskId === taskRow.id
    },
    handlePageChange (page) {
      this.currentPage = page
      this.fetchTaskList()
    },
    closeModal () {
      this.$emit('update:visible', false)
      this.$emit('close')
    },
    taskTypeLabel (taskType) {
      if (!taskType) return '—'
      return TASK_TYPE_LABEL_MAP[taskType] || taskType
    },
    formatTaskTime (taskRow) {
      const raw =
        taskRow.last_seen_time ||
        taskRow.update_time ||
        taskRow.create_time ||
        ''
      return raw || '—'
    },
    async fetchTaskList () {
      if (!this.modalType) return
      const status = modalTypeToApiStatus(this.modalType)
      this.loading = true
      try {
        const merged = []
        for (const category of TODO_CATEGORY_ORDER) {
          const response = await taskListNewAPI({
            category,
            task_type: '风险处置',
            status
          })
          console.log('[workbench] taskDetailsPop taskListNewAPI:', {
            category,
            status,
            response
          })
          if (response && response.code === 0 && response.data) {
            const list = Array.isArray(response.data.list)
              ? response.data.list
              : []
            merged.push(...list)
          }
        }
        const total = merged.length
        const start = (this.currentPage - 1) * this.pageSize
        this.taskList = merged.slice(start, start + this.pageSize)
        this.total = total
      } catch (error) {
        console.error('[workbench] taskDetailsPop taskListNewAPI error:', error)
        this.taskList = []
        this.total = 0
        if (this.$message) {
          this.$message.error('加载任务列表失败')
        }
      } finally {
        this.loading = false
      }
    },
    /** 供父组件在治理完成后刷新列表 */
    refresh () {
      if (this.visible && this.modalType) {
        this.fetchTaskList()
      }
    },
    handleRowExecute (taskRow) {
      if (!taskRow || taskRow.id == null) return
      if (taskRow.task_type === 'critical_vuln_unfixed') {
        this.$emit('execute-critical-vuln', { ...taskRow })
        return
      }
      this.$emit('execute-other-task', { ...taskRow })
    }
  }
}
</script>

<style lang="scss" scoped>
$zinc900: #18181b;
$zinc950: #09090b;
$white: #fff;
$white08: rgba(255, 255, 255, 0.08);
$white10: rgba(255, 255, 255, 0.1);
$white12: rgba(255, 255, 255, 0.12);
$white20: rgba(255, 255, 255, 0.2);
$white40: rgba(255, 255, 255, 0.4);
$white50: rgba(255, 255, 255, 0.5);
$white60: rgba(255, 255, 255, 0.6);
$white80: rgba(255, 255, 255, 0.88);
$violet: #9333ea;
$violetSoft: rgba(147, 51, 234, 0.35);
$emerald: #10b981;
$amber: #f59e0b;

.task-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(9, 9, 11, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-sizing: border-box;
}

.task-modal {
  position: relative;
  width: 100%;
  max-width: 680px;
  background: linear-gradient(
    165deg,
    rgba(39, 39, 42, 0.98) 0%,
    $zinc950 40%,
    $zinc900 100%
  );
  border: 1px solid $white12;
  border-radius: 28px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 32px 64px -16px rgba(0, 0, 0, 0.65),
    0 0 80px -20px rgba(147, 51, 234, 0.15);
  overflow: hidden;
}

/* 顶部语义色条 */
.task-modal-accent-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, $violet, #a855f7, #c084fc);
  opacity: 0.85;
}

.task-modal--accent-emerald .task-modal-accent-bar {
  background: linear-gradient(90deg, #059669, $emerald, #34d399);
}

.task-modal--accent-amber .task-modal-accent-bar {
  background: linear-gradient(90deg, #d97706, $amber, #fbbf24);
}

.task-modal--accent-violet .task-modal-accent-bar {
  background: linear-gradient(90deg, #7c3aed, $violet, #c084fc);
}

.task-modal-header {
  position: relative;
  padding: 22px 22px 20px;
  border-bottom: 1px solid $white08;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.06) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.task-modal-header-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.task-modal-header-text {
  min-width: 0;
}

.task-modal-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
  &.task-card-icon--emerald {
    background: linear-gradient(
      145deg,
      rgba(16, 185, 129, 0.35),
      rgba(16, 185, 129, 0.12)
    );
    color: #6ee7b7;
    border: 1px solid rgba(52, 211, 153, 0.25);
  }
  &.task-card-icon--amber {
    background: linear-gradient(
      145deg,
      rgba(245, 158, 11, 0.4),
      rgba(245, 158, 11, 0.12)
    );
    color: #fcd34d;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }
  &.task-card-icon--purple {
    background: linear-gradient(
      145deg,
      rgba(147, 51, 234, 0.45),
      rgba(147, 51, 234, 0.15)
    );
    color: #e9d5ff;
    border: 1px solid $violetSoft;
  }
}

.task-modal-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: $white;
  line-height: 1.25;
}

.task-modal-meta {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: $white50;
  font-weight: 500;
}

.task-modal-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 800;
  color: #e9d5ff;
  background: rgba(147, 51, 234, 0.22);
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 999px;
}

.task-modal-meta-label {
  color: $white40;
}

.task-modal-meta-loading {
  margin-left: 4px;
  font-size: 11px;
  color: $violetSoft;
  animation: task-meta-pulse 1.2s ease-in-out infinite;
}

@keyframes task-meta-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.task-modal-close {
  width: 36px;
  height: 36px;
  border: 1px solid $white10;
  background: $white08;
  color: $white50;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 18px;
  flex-shrink: 0;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s,
    transform 0.15s;
  &:hover {
    background: $white12;
    border-color: $white20;
    color: $white;
  }
  &:active {
    transform: scale(0.96);
  }
}

.task-modal-body {
  position: relative;
  padding: 20px 22px 22px;
  max-height: min(58vh, 520px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 140px;
}

/* Element UI v-loading 默认浅色遮罩会在深色弹框内闪白，强制与弹框同系深色 + 轻微模糊 */
.task-modal-body ::v-deep .el-loading-mask {
  background-color: rgba(9, 9, 11, 0.78) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.task-modal-body ::v-deep .el-loading-spinner .path {
  stroke: #c4b5fd;
}

.task-modal-body ::v-deep .el-loading-text {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.task-modal-body ::v-deep .task-modal-loading.el-loading-mask {
  background-color: rgba(9, 9, 11, 0.82) !important;
}

/* 列表区域滚动条 */
.custom-scrollbar-task {
  scrollbar-width: thin;
  scrollbar-color: rgba(167, 139, 250, 0.35) transparent;
}
.custom-scrollbar-task::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar-task::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar-task::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.25);
  border-radius: 999px;
}
.custom-scrollbar-task::-webkit-scrollbar-thumb:hover {
  background: rgba(167, 139, 250, 0.45);
}

.task-modal-item {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid $white10;
  border-radius: 18px;
  padding: 16px 16px 14px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 4px 4px 0;
    background: linear-gradient(180deg, $violet, #a855f7);
    opacity: 0.65;
  }
  &:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(167, 139, 250, 0.22);
    box-shadow: 0 8px 24px -12px rgba(0, 0, 0, 0.45);
  }
}

.task-modal-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-left: 6px;
}

.task-modal-item-top-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.task-modal-item-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: $white80;
  flex: 1;
  min-width: 0;
  line-height: 1.45;
}

.task-modal-item-time {
  font-size: 10px;
  color: $white40;
  font-weight: 600;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid $white10;
  border-radius: 8px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.task-modal-item-execute {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fafafa;
  background: linear-gradient(135deg, #7c3aed 0%, $violet 55%, #7e22ce 100%);
  border: 1px solid rgba(196, 181, 253, 0.35);
  border-radius: 10px;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 4px 14px -4px rgba(147, 51, 234, 0.55);
  transition:
    filter 0.2s,
    transform 0.15s;
  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  &:active:not(:disabled) {
    transform: scale(0.97);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.task-modal-item-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding-left: 6px;
}

.task-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 11px;
  color: $white50;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid $white10;
  border-radius: 999px;
  i {
    font-size: 12px;
    opacity: 0.75;
    color: #c4b5fd;
  }
  strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 700;
    color: #e4e4e7;
  }
}

.task-chip--type {
  color: #ddd6fe;
  border-color: rgba(167, 139, 250, 0.25);
  background: rgba(147, 51, 234, 0.12);
}

.task-modal-item-detail {
  margin-left: 6px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid $white08;
  border-radius: 10px;
}

.task-modal-item-detail-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: $white40;
  margin-bottom: 8px;
  i {
    font-size: 12px;
    color: #a78bfa;
  }
}

.task-modal-item-detail-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: $white60;
  word-break: break-word;
}

.task-modal-empty {
  text-align: center;
  padding: 40px 20px 48px;
}

.task-modal-empty-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(147, 51, 234, 0.12);
  border: 1px dashed rgba(167, 139, 250, 0.35);
  color: #a78bfa;
  font-size: 26px;
}

.task-modal-empty-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: $white60;
}

.task-modal-empty-desc {
  margin: 0;
  font-size: 12px;
  color: $white40;
  line-height: 1.5;
}

.task-modal-pagination-wrap {
  display: flex;
  justify-content: center;
  padding: 4px 0 0;
}

.task-modal-pagination-wrap ::v-deep .el-pagination {
  .btn-prev,
  .btn-next,
  .el-pager li {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    color: $white50;
    min-width: 28px;
  }
  .el-pager li:hover {
    color: #ddd6fe;
  }
  .el-pager li.active {
    color: #e9d5ff;
    font-weight: 700;
    background: rgba(147, 51, 234, 0.25);
  }
  .el-pagination__total {
    color: $white40;
    font-size: 12px;
  }
}

.task-details-modal-fade-enter-active,
.task-details-modal-fade-leave-active {
  transition: opacity 0.24s ease;
}
.task-details-modal-fade-enter-active .task-modal {
  animation: task-modal-pop-in 0.28s cubic-bezier(0.34, 1.15, 0.64, 1) both;
}
.task-details-modal-fade-enter,
.task-details-modal-fade-leave-to {
  opacity: 0;
}

@keyframes task-modal-pop-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
