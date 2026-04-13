<template>
  <section class="abnormal-events-panel">
    <div class="abnormal-events-panel__header">
      <h3 class="abnormal-events-panel__title">
        <el-icon class="abnormal-events-panel__title-icon">
          <Warning />
        </el-icon>
        异常事件
      </h3>

      <el-button
        v-if="isLearningPeriod"
        type="text"
        class="abnormal-events-panel__config-btn"
        @click="$emit('view-learning-config')"
      >
        查看当前学习期配置
      </el-button>
    </div>

    <div
      class="abnormal-events-panel__body ledger-triangle-loading-anchor"
      :class="{ 'is-learning': isLearningPeriod }"
    >

      <div class="abnormal-events-panel__scroll custom-scrollbar-am">
        <div v-if="!loading && !hasEvents" class="abnormal-events-panel__empty">
          <div class="abnormal-events-panel__empty-icon">
            <el-icon><Document /></el-icon>
          </div>
          <h4 class="abnormal-events-panel__empty-title">暂无数据</h4>
          <p class="abnormal-events-panel__empty-desc">
            当前筛选条件下暂无异常事件数据。<br />
            您的网络环境目前处于安全状态。
          </p>
        </div>

        <div v-else class="abnormal-events-panel__list">
          <AbnormalEventCard
            v-for="eventItem in events"
            :key="eventItem.id"
            :event="eventItem"
            @toggle-analysis="$emit('toggle-analysis', $event)"
            @confirm-access-relation="$emit('confirm-access-relation', $event)"
          />
        </div>
      </div>

      <div v-if="isLearningPeriod" class="abnormal-events-panel__mask">
        <div class="abnormal-events-panel__mask-card">
          <div class="abnormal-events-panel__mask-icon">
            <el-icon><Lock /></el-icon>
          </div>
          <h4 class="abnormal-events-panel__mask-title">当前处于流量学习阶段</h4>
          <p class="abnormal-events-panel__mask-desc">
            暂时无法查看相关数据，请在学习阶段结束后重试
          </p>
          <el-button
            type="primary"
            size="small"
            :loading="configLoading"
            @click="$emit('view-learning-config')"
          >
            查看当前学习期配置
          </el-button>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Warning, Document, Lock } from '@element-plus/icons-vue'
import AbnormalEventCard from './AbnormalEventCard.vue'

interface Pagination {
  current_page: number
  page_size: number
  total: number
  total_pages?: number
}

const props = defineProps<{
  events: any[]
  loading?: boolean
  pagination: Pagination
  isLearningPeriod?: boolean
  configLoading?: boolean
}>()

defineEmits<{
  (e: 'toggle-analysis', id: string): void
  (e: 'confirm-access-relation', payload: any): void
  (e: 'view-learning-config'): void
}>()

const hasEvents = computed(() => Array.isArray(props.events) && props.events.length > 0)
</script>

<style scoped lang="scss">
.abnormal-events-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    padding: 0 4px;
  }

  &__title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #18181b;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title-icon {
    font-size: 18px;
    color: var(--default-color);
  }

  &__config-btn {
    padding: 0;
    font-size: 12px;
    font-weight: 600;
    white-space: normal;
    text-align: right;
  }

  &__body {
    position: relative;
    // min-height: 280px;

    &.is-learning {
      overflow: hidden;
    }
  }

  &__scroll {
    display: block;
    max-height: min(960px, calc(100vh - 305px));
    overflow-y: auto;
    padding-right: 8px;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 16px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    margin: 16px 0;
    text-align: center;
    background: #fafafa;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    min-height: 180px;
  }

  &__empty-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #e8e8e8;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;

    :deep(svg) {
      font-size: 24px;
      color: #a1a1aa;
    }
  }

  &__empty-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: #333;
  }

  &__empty-desc {
    margin: 0;
    font-size: 14px;
    color: #999;
    line-height: 1.6;
  }

  &__mask {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(6px);
    z-index: 2;
  }

  &__mask-card {
    width: min(100%, 360px);
    padding: 28px 24px;
    border-radius: 16px;
    border: 1px solid rgba(var(--default-color-rgb), 0.16);
    background:
      linear-gradient(135deg, rgba(var(--default-color-rgb), 0.12), rgba(255, 255, 255, 0.95)),
      #fff;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
    text-align: center;
  }

  &__mask-icon {
    width: 54px;
    height: 54px;
    margin: 0 auto 14px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--default-color);
    background: rgba(var(--default-color-rgb), 0.14);

    :deep(svg) {
      font-size: 24px;
    }
  }

  &__mask-title {
    margin: 0 0 10px;
    font-size: 18px;
    font-weight: 700;
    color: #18181b;
  }

  &__mask-desc {
    margin: 0 0 18px;
    line-height: 1.7;
    font-size: 13px;
    color: #52525b;
  }

}

@media (min-width: 1280px) {
  .abnormal-events-panel__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.custom-scrollbar-am {
  scrollbar-width: thin;
  scrollbar-color: rgb(186 186 190) #f4f4f5;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f4f4f5;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(var(--default-color-rgb), 0.35);
    border-radius: 3px;
  }
}

@media (max-width: 768px) {
  .abnormal-events-panel {
    gap: 12px;

    &__header {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
      padding: 0;
    }

    &__config-btn {
      text-align: left;
    }

    &__scroll {
      max-height: none;
      padding-right: 0;
    }

    &__list {
      gap: 12px;
    }

    &__empty {
      min-height: 160px;
      padding: 36px 18px;
      margin: 8px 0;
    }

    &__empty-title {
      font-size: 16px;
    }

    &__empty-desc {
      font-size: 13px;
    }

    &__mask {
      padding: 16px;
    }

    &__mask-card {
      padding: 22px 18px;
      border-radius: 14px;
    }

    &__mask-title {
      font-size: 16px;
    }

  }
}

@media (max-width: 480px) {
  .abnormal-events-panel {
    &__title {
      font-size: 13px;
    }

    &__mask {
      padding: 12px;
    }

    &__mask-card {
      padding: 18px 14px;
    }

    &__mask-desc {
      font-size: 12px;
    }
  }
}
</style>
