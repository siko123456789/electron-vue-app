<template>
  <div class="abnormal-event-card">
    <div class="abnormal-event-card__body">
      <div class="abnormal-event-card__head">
        <div
          class="abnormal-event-card__icon"
          :class="'is-severity-' + cardSeverity"
        >
          <el-icon v-if="event.type === 'baseline_anomaly'">
            <WarningFilled />
          </el-icon>
          <el-icon v-else-if="event.type === 'new_asset_service'">
            <Location />
          </el-icon>
          <el-icon v-else>
            <Platform />
          </el-icon>
        </div>

        <div class="abnormal-event-card__main">
          <div class="abnormal-event-card__title-row">
            <h3 class="abnormal-event-card__title">{{ displayTitle }}</h3>
            <span
              class="abnormal-event-card__severity"
              :class="'is-' + cardSeverity"
            >
              {{ severityText }}
            </span>
          </div>
          <p class="abnormal-event-card__desc">{{ displayDescription }}</p>
        </div>
      </div>

      <div class="abnormal-event-card__toolbar">
        <div class="abnormal-event-card__time">{{ event.time }}</div>
        <button
          type="button"
          class="abnormal-event-card__analyze-btn"
          :class="{ 'is-active': event.isExpanded }"
          :disabled="event.isAnalyzing || event.isResponding"
          @click="$emit('toggle-analysis', event.id)"
        >
          <el-icon v-if="event.isAnalyzing" class="abnormal-event-card__spin">
            <Loading />
          </el-icon>
          <el-icon v-else>
            <VideoPlay />
          </el-icon>
          {{ event.isExpanded ? '收起' : '分析' }}
        </button>
      </div>

      <transition name="abnormal-expand">
        <div v-show="event.isExpanded" class="abnormal-event-card__expand">
          <div class="abnormal-event-card__expand-inner">
            <div class="abnormal-event-card__block">
              <div class="abnormal-event-card__audiences-head">
                <div
                  class="abnormal-event-card__block-title abnormal-event-card__block-title--inline"
                >
                  <el-icon><UserFilled /></el-icon>
                  新增受众对象
                </div>

                <div
                  v-if="batchSelectMode && showBatchSelector"
                  class="abnormal-event-card__selection-head"
                >
                  <el-checkbox
                    :model-value="isAllSelected"
                    :indeterminate="isIndeterminate"
                    @change="handleCheckAllChange"
                  >
                    全选
                  </el-checkbox>
                  <span class="abnormal-event-card__selection-count">
                    已选 {{ selectedBatchIps.length }}/{{ audienceList.length }}
                  </span>
                </div>
              </div>

              <div
                v-for="(audienceIp, audienceIndex) in audienceList"
                :key="audienceIndex"
                class="abnormal-event-card__audience-row"
              >
                <el-checkbox
                  v-if="batchSelectMode"
                  :model-value="selectedBatchIps.includes(audienceIp)"
                  class="abnormal-event-card__audience-checkbox"
                  @change="toggleAudienceSelection(audienceIp, $event)"
                />
                <span class="abnormal-event-card__mono">{{ audienceIp }}</span>

                <button
                  v-if="!batchSelectMode"
                  type="button"
                  class="abnormal-event-card__mini-btn"
                  @click="
                    $emit('confirm-access-relation', {
                      eventId: event.id,
                      ip: audienceIp
                    })
                  "
                >
                  确认访问关系
                </button>
              </div>

              <div
                v-if="!hasAudienceData"
                class="abnormal-event-card__audience-empty"
              >
                暂无新增受众数据
              </div>
            </div>

            <div
              class="abnormal-event-card__actions abnormal-event-card__actions--batch"
            >
              <el-tooltip
                content="确认该访问为正常业务行为，纳入访问基线，后续不再重复告警"
                placement="top"
                effect="dark"
                :open-delay="200"
              >
                <div class="abnormal-event-card__tooltip-wrap">
                  <button
                    v-if="!batchSelectMode"
                    type="button"
                    class="abnormal-event-card__action-primary abnormal-event-card__action-primary--full"
                    :disabled="!hasAudienceData"
                    @click="enterBatchSelect"
                  >
                    批量设置正常访问
                  </button>

                  <div v-else class="abnormal-event-card__batch-actions">
                    <button
                      type="button"
                      class="abnormal-event-card__action-secondary"
                      @click="cancelBatchSelect"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="abnormal-event-card__action-primary abnormal-event-card__action-primary--flex"
                      :disabled="!selectedBatchIps.length"
                      @click="submitBatchSelect"
                    >
                      确认设置正常访问
                    </button>
                  </div>
                </div>
              </el-tooltip>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  WarningFilled,
  Location,
  Platform,
  Loading,
  VideoPlay,
  UserFilled
} from '@element-plus/icons-vue'

const props = defineProps<{
  event: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'toggle-analysis', id: string): void
  (e: 'confirm-access-relation', payload: any): void
}>()

const batchSelectMode = ref(false)
const selectedBatchIps = ref<string[]>([])

const audienceList = computed<string[]>(() => {
  return props.event.analysisData?.newAudiences || []
})

const hasAudienceData = computed(() => audienceList.value.length > 0)
const showBatchSelector = computed(() => audienceList.value.length > 1)

const isAllSelected = computed(() => {
  return hasAudienceData.value && selectedBatchIps.value.length === audienceList.value.length
})

const isIndeterminate = computed(() => {
  return selectedBatchIps.value.length > 0 &&
    selectedBatchIps.value.length < audienceList.value.length
})

const isBaselineAnomaly = computed(() => props.event.type === 'baseline_anomaly')
const isNewAssetService = computed(() => props.event.type === 'new_asset_service')
const isExistingAssetService = computed(() => props.event.type === 'existing_asset_service')

const displayTitle = computed(() => {
  if (isBaselineAnomaly.value) return '检测到业务关系基线异常'
  if (isNewAssetService.value) return '发现了新的服务（新资产）'
  if (isExistingAssetService.value) return '发现了新的服务（已有资产）'
  return props.event.title || ''
})

const displayDescription = computed(() => {
  if (isBaselineAnomaly.value) {
    const destIp = props.event.dest_ip || props.event.destIp || props.event.assetIp || ''
    const dstPort = props.event.dst_port || props.event.dstPort || props.event.port || ''
    const protocol = props.event.proto || props.event.protocol || ''
    const srcIpList =
      Array.isArray(props.event.src_ips) && props.event.src_ips.length
        ? props.event.src_ips
        : props.event.analysisData?.newAudiences || []

    const srcIp = props.event.src_ip || props.event.srcIp || srcIpList[0] || ''
    const serviceLabel = dstPort
      ? `${dstPort}${protocol ? ` (${protocol})` : ''} 端口服务`
      : '端口服务'
    const audienceText = srcIp ? `，新增了一个受众对象：${srcIp}` : ''

    if (destIp) return `${destIp} 的 ${serviceLabel}${audienceText}`
  }

  if (isNewAssetService.value || isExistingAssetService.value) {
    const destIp = props.event.dest_ip || props.event.destIp || props.event.assetIp || ''
    const dstPort = props.event.dst_port || props.event.dstPort || props.event.port || ''
    const protocol = props.event.proto || props.event.protocol || ''
    const assetLabel = isExistingAssetService.value ? '已有资产' : '新的IP'
    return `检测到 ${destIp || '-'}（${assetLabel}）提供了新的服务 ${dstPort ?? '-'}${protocol ? ` (${protocol})` : ''}`
  }

  return props.event.description || ''
})

const cardSeverity = computed(() => {
  if (isBaselineAnomaly.value) return 'high'
  if (isNewAssetService.value) return 'warning'
  if (isExistingAssetService.value) return 'info'
  return props.event.severity || 'info'
})

const severityText = computed(() => {
  const levelMap: Record<string, string> = {
    high: 'HIGH',
    warning: 'WARNING',
    info: 'INFO'
  }
  return levelMap[cardSeverity.value] || String(cardSeverity.value || '').toUpperCase()
})

watch(
  () => props.event.isExpanded,
  (value) => {
    if (!value) {
      resetBatchSelect()
    }
  }
)

watch(audienceList, (value) => {
  if (!batchSelectMode.value) return
  const nextSelectedIps = selectedBatchIps.value.filter((ip) => value.includes(ip))
  selectedBatchIps.value =
    nextSelectedIps.length || !value.length ? nextSelectedIps : value.slice()
})

function enterBatchSelect() {
  if (!hasAudienceData.value) return

  if (!showBatchSelector.value) {
    emit('confirm-access-relation', {
      eventId: props.event.id,
      ips: audienceList.value.slice(),
      isBatch: true
    })
    return
  }

  batchSelectMode.value = true
  selectedBatchIps.value = audienceList.value.slice()
}

function cancelBatchSelect() {
  resetBatchSelect()
}

function resetBatchSelect() {
  batchSelectMode.value = false
  selectedBatchIps.value = []
}

function handleCheckAllChange(checked: string | number | boolean) {
  selectedBatchIps.value = checked ? audienceList.value.slice() : []
}

function toggleAudienceSelection(audienceIp: string, checked: string | number | boolean) {
  if (checked) {
    if (!selectedBatchIps.value.includes(audienceIp)) {
      selectedBatchIps.value = selectedBatchIps.value.concat(audienceIp)
    }
    return
  }

  selectedBatchIps.value = selectedBatchIps.value.filter((ip) => ip !== audienceIp)
}

function submitBatchSelect() {
  if (!selectedBatchIps.value.length) return

  emit('confirm-access-relation', {
    eventId: props.event.id,
    ips: selectedBatchIps.value.slice(),
    isBatch: true
  })

  resetBatchSelect()
}
</script>

<style scoped lang="scss">
.abnormal-event-card {
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: rgba(var(--default-color-rgb), 0.35);
  }

  &__body {
    padding: 16px;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 16px;

    &.is-severity-high {
      background: #fef2f2;
      color: #dc2626;
    }

    &.is-severity-warning {
      background: #fff7ed;
      color: #ea580c;
    }

    &.is-severity-info {
      background: #eff6ff;
      color: #2563eb;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #18181b;
    line-height: 1.4;
  }

  &__severity {
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;

    &.is-high {
      background: #fee2e2;
      color: #b91c1c;
    }

    &.is-warning {
      background: #ffedd5;
      color: #c2410c;
    }

    &.is-info {
      background: #dbeafe;
      color: #1d4ed8;
    }
  }

  &__desc {
    margin: 0;
    font-size: 12px;
    color: #71717a;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__toolbar {
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__time {
    font-size: 11px;
    color: #a1a1aa;
    font-family: ui-monospace, monospace;
    line-height: 1.5;
    word-break: break-all;
  }

  &__analyze-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    border: none;
    background: rgba(var(--default-color-rgb), 0.08);
    color: var(--default-color);
    border-radius: 8px;
    padding: 0 10px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }

  &__analyze-btn.is-active {
    background: rgba(var(--default-color-rgb), 0.16);
  }

  &__expand {
    margin-top: 14px;
    border-top: 1px solid #f0f0f0;
    padding-top: 14px;
  }

  &__expand-inner {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__block-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #18181b;
    font-size: 12px;
    font-weight: 700;
  }

  &__audiences-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 10px;
  }

  &__selection-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__selection-count {
    font-size: 12px;
    color: #71717a;
  }

  &__audience-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 34px;
    padding: 6px 10px;
    border-radius: 8px;
    background: #fafafa;
    margin-bottom: 8px;
  }

  &__mono {
    flex: 1;
    min-width: 0;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: #27272a;
    overflow-wrap: anywhere;
  }

  &__mini-btn,
  &__action-primary,
  &__action-secondary {
    border: none;
    cursor: pointer;
    border-radius: 8px;
    font-size: 12px;
    transition: all 0.2s ease;
  }

  &__mini-btn {
    height: 28px;
    padding: 0 10px;
    background: rgba(var(--default-color-rgb), 0.08);
    color: var(--default-color);
    font-weight: 600;
  }

  &__audience-empty {
    padding: 16px 0 4px;
    color: #a1a1aa;
    font-size: 12px;
  }

  &__actions--batch {
    margin-top: 4px;
  }

  &__tooltip-wrap {
    width: 100%;
  }

  &__action-primary--full {
    width: 100%;
    height: 34px;
    background: var(--default-color);
    color: #fff;
    font-weight: 700;
  }

  &__batch-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__action-secondary {
    flex: 1;
    height: 34px;
    background: #f4f4f5;
    color: #52525b;
  }

  &__action-primary--flex {
    flex: 1;
    height: 34px;
    background: var(--default-color);
    color: #fff;
    font-weight: 700;
  }

  &__spin {
    animation: spin 1s linear infinite;
  }
}

@media (max-width: 768px) {
  .abnormal-event-card {
    border-radius: 14px;

    &__body {
      padding: 14px;
    }

    &__head {
      gap: 10px;
    }

    &__icon {
      width: 30px;
      height: 30px;
      border-radius: 10px;
    }

    &__title {
      font-size: 12px;
    }

    &__severity {
      font-size: 10px;
    }

    &__desc {
      font-size: 11px;
      -webkit-line-clamp: 3;
    }

    &__toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    &__analyze-btn {
      justify-content: center;
      width: 100%;
    }

    &__selection-head {
      flex-wrap: wrap;
      gap: 6px 10px;
    }

    &__audience-row {
      align-items: flex-start;
      padding: 10px;
    }

    &__audience-checkbox {
      margin-top: 2px;
    }

    &__mini-btn {
      width: 100%;
      height: 32px;
    }

    &__action-primary--full,
    &__action-primary--flex,
    &__action-secondary {
      min-height: 36px;
    }
  }
}

@media (max-width: 480px) {
  .abnormal-event-card {
    &__body {
      padding: 12px;
    }

    &__toolbar {
      gap: 10px;
    }

    &__time {
      font-size: 10px;
    }

    &__batch-actions {
      flex-direction: column;
    }

    &__action-secondary,
    &__action-primary--flex {
      width: 100%;
    }
  }
}

.abnormal-expand-enter-active,
.abnormal-expand-leave-active {
  transition: all 0.2s ease;
}

.abnormal-expand-enter-from,
.abnormal-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
