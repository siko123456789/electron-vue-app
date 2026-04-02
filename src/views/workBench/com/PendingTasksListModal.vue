<template>
  <!-- 待执行任务弹框 -->
  <el-dialog
    v-model="dialogVisible"
    :show-close="false"
    width="720px"
    top="18vh"
    :custom-class="
  covered
    ? 'pending-tasks-list-dialog pending-tasks-list-dialog--covered'
    : 'pending-tasks-list-dialog'
"
    append-to-body
    @close="handleClose"
  >
    <div class="pending-dialog-shell">
      <div class="pending-dialog-head">
        <div class="pending-dialog-head-left">
          <div class="pending-dialog-head-icon">
            <i class="iconfont icon-zhihangrenwu"></i>
          </div>
          <div>
            <h3 class="pending-dialog-title">待执行的任务</h3>
            <p class="pending-dialog-sub">共 {{ apiDisplayList.length || 0 }} 个任务</p>
          </div>
        </div>

        <el-button link class="pending-dialog-close" @click="handleClose">
          <el-icon>
            <Close />
          </el-icon>
        </el-button>
      </div>

      <div class="pending-dialog-filter">
        <div class="pending-dialog-filter-row pending-dialog-filter-row--tags-only">
          <div class="pending-filter-tags" role="toolbar" aria-label="任务类型筛选">
            <el-button
              v-for="tagItem in categoryOptions"
              :key="tagItem"
              size="small"
              :type="taskFilterType === tagItem ? 'primary' : 'default'"
              plain
              class="pending-filter-btn"
              @click="taskFilterType = tagItem"
            >{{ tagItem }}</el-button>
          </div>
        </div>
      </div>

      <div
        class="pending-dialog-body"
        v-loading="listLoading"
        element-loading-text="加载中..."
        element-loading-background="rgba(15, 10, 40, 0.65)"
      >
        <div
          v-for="taskRow in apiDisplayList"
          :key="taskRow.id"
          class="pending-task-item"
          :class="'pending-task-item--' + taskRow.categoryVariant"
        >
          <div class="pending-task-item-head">
            <div class="pending-task-item-head-main">
              <span class="pending-task-category-pill">{{ taskRow.categoryLabel }}</span>
              <h4 class="pending-task-item-title">{{ taskRow.title }}</h4>
            </div>
          </div>

          <div class="pending-task-detail-grid">
            <div v-for="cell in taskRow.detailCells" :key="cell.key" class="pending-task-cell">
              <span class="pending-task-cell-label">{{ cell.label }}</span>
              <span
                class="pending-task-cell-value"
                :class="{ 'pending-task-cell-value--mono': cell.mono }"
                :title="cell.value"
              >{{ cell.value }}</span>
            </div>
          </div>

          <div class="pending-task-item-actions">
            <el-button
              type="primary"
              size="small"
              class="pending-task-govern-btn"
              @click="emitGovernTask(taskRow)"
            >立即治理</el-button>
          </div>
        </div>

        <div v-if="!listLoading && apiDisplayList.length === 0" class="pending-dialog-empty">暂无待办任务</div>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Close } from "@element-plus/icons-vue";
import { taskListNewAPI } from "@/api/aiGovernance";

export default {
  name: "PendingTasksListModal",
  components: {
    Close
  },
  props: {
    /** 是否展示弹框 */
    visible: {
      type: Boolean,
      default: false
    },
    /** 保留兼容父级传入，当前列表以 taskListNewAPI 为准 */
    taskList: {
      type: Array,
      default: () => []
    },
    covered: {
      type: Boolean,
      default: false
    }
  },
  emits: ["update:visible", "close", "govern-task"],
  setup(props, { emit }) {
    /** 默认关键漏洞，与接口 category 一致 */
    const taskFilterType = ref("关键漏洞");
    /** 与接口 category 枚举一致（不含「全部」） */
    const categoryOptions = ["关键漏洞", "弱口令", "高危端口"];
    const listLoading = ref(false);
    const apiTotal = ref(0);
    const apiDisplayList = ref([]);

    const dialogVisible = computed({
      get() {
        return props.visible;
      },
      set(value) {
        emit("update:visible", value);
      }
    });

    /** 头部展示总数（接口 total） */
    const listTotal = computed(() => apiTotal.value);

    /** 漏洞等级数字 → 文案 */
    const formatVulnLevelLabel = level => {
      if (level === undefined || level === null || level === "") return "—";
      const levelMap = {
        0: "低危",
        1: "中危",
        2: "高危",
        3: "紧急",
        4: "关键漏洞"
      };
      return levelMap[level] != null ? levelMap[level] : `等级 ${level}`;
    };

    /** 按 category 拆出重要字段，供卡片分区展示 */
    const mapTodoItemToRow = apiRow => {
      const category = apiRow.category || "";
      const categoryVariant =
        category === "弱口令"
          ? "weak"
          : category === "高危端口"
          ? "port"
          : "critical";

      const ip = apiRow.asset_ip || apiRow.task_key || "—";
      const portText =
        apiRow.port !== undefined && apiRow.port !== null && apiRow.port !== ""
          ? String(apiRow.port)
          : "—";
      const time = apiRow.task_update_time || apiRow.task_create_time || "—";

      let title = "—";
      let detailCells = [];

      if (categoryVariant === "critical") {
        title =
          (apiRow.vuln_name && String(apiRow.vuln_name).trim()) ||
          apiRow.task_title ||
          "—";

        const numberFirst =
          apiRow.vuln_number && String(apiRow.vuln_number).trim()
            ? String(apiRow.vuln_number)
                .split(",")[0]
                .trim()
            : "";

        detailCells = [
          { key: "ip", label: "资产 IP", value: ip, mono: true },
          { key: "port", label: "端口", value: portText, mono: true },
          {
            key: "cve",
            label: "漏洞编号",
            value: numberFirst || "—",
            mono: true
          },
          {
            key: "level",
            label: "风险等级",
            value: formatVulnLevelLabel(apiRow.vuln_level),
            mono: false
          }
        ];
      } else if (categoryVariant === "weak") {
        title =
          (apiRow.vuln_name && String(apiRow.vuln_name).trim()) ||
          apiRow.task_title ||
          "—";

        detailCells = [
          { key: "ip", label: "资产 IP", value: ip, mono: true },
          { key: "port", label: "端口", value: portText, mono: true }
        ];
      } else {
        const serviceText =
          apiRow.service && String(apiRow.service).trim()
            ? String(apiRow.service)
            : "—";

        if (serviceText !== "—") {
          title =
            portText !== "—"
              ? `${serviceText} · 端口 ${portText}`
              : serviceText;
        } else if (portText !== "—") {
          title = `端口 ${portText}`;
        } else {
          title = apiRow.task_title || "高危端口";
        }

        detailCells = [
          { key: "ip", label: "资产 IP", value: ip, mono: true },
          { key: "port", label: "端口", value: portText, mono: true },
          { key: "service", label: "服务", value: serviceText, mono: false }
        ];
      }

      return {
        id: apiRow.id,
        categoryLabel: category || "待处置",
        categoryVariant,
        title,
        time,
        detailCells,
        raw: apiRow
      };
    };

    /** 请求待办分项列表 */
    const fetchTodoTaskList = async () => {
      listLoading.value = true;
      try {
        const response = await taskListNewAPI({
          category: taskFilterType.value,
          task_type: "风险处置",
          status: 0
        });

        console.log("[workbench] PendingTasksListModal taskListNewAPI:", {
          category: taskFilterType.value,
          response
        });

        if (response && response.code === 0 && response.data) {
          apiTotal.value = Number(response.data.total) || 0;
          const rawList = Array.isArray(response.data.list)
            ? response.data.list
            : [];
          apiDisplayList.value = rawList.map(row => mapTodoItemToRow(row));
        } else {
          apiTotal.value = 0;
          apiDisplayList.value = [];
        }
      } catch (error) {
        console.error(
          "[workbench] PendingTasksListModal taskListNewAPI error:",
          error
        );
        apiTotal.value = 0;
        apiDisplayList.value = [];
        ElMessage.error("任务列表加载失败");
      } finally {
        listLoading.value = false;
      }
    };

    /** 关闭弹框 */
    const handleClose = () => {
      dialogVisible.value = false;
      emit("close");
    };

    /** 立即治理：抛出展示行（含 raw 为接口原始行，父级按 raw.category 打开对应治理弹框） */
    const emitGovernTask = taskRow => {
      console.log("govern-task", taskRow);
      emit("govern-task", taskRow);
    };

    watch(
      () => props.visible,
      opened => {
        if (!opened) {
          taskFilterType.value = "关键漏洞";
          apiDisplayList.value = [];
          apiTotal.value = 0;
          document.body.classList.remove("pending-tasks-list-modal-open");
          return;
        }

        nextTick(() => {
          document.body.classList.add("pending-tasks-list-modal-open");
          fetchTodoTaskList();
        });
      },
      { immediate: true }
    );

    watch(taskFilterType, () => {
      if (!props.visible) return;
      fetchTodoTaskList();
    });

    onBeforeUnmount(() => {
      document.body.classList.remove("pending-tasks-list-modal-open");
    });

    return {
      taskFilterType,
      categoryOptions,
      listLoading,
      apiTotal,
      apiDisplayList,
      dialogVisible,
      listTotal,
      handleClose,
      emitGovernTask
    };
  }
};
</script>

<style lang="scss" scoped>
:deep(.pending-tasks-list-dialog.pending-tasks-list-dialog--covered) {
  opacity: 0;
  pointer-events: none;
}

.pending-dialog-shell {
  margin-top: -20px;
  border-radius: var(--dialog-border-radius);
  overflow: hidden;
}

.pending-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.pending-dialog-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.pending-dialog-head-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #111827;
  font-size: 20px;
}

.pending-dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  color: #111827;
  letter-spacing: -0.02em;
}

.pending-dialog-sub {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.pending-dialog-close {
  font-size: 18px;
  color: #4b5563 !important;
  padding: 8px;

  &:hover {
    color: #111827 !important;
  }
}

.pending-dialog-filter {
  padding: 15px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.pending-dialog-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
}

.pending-dialog-filter-row--tags-only {
  justify-content: flex-start;

  .pending-filter-tags {
    max-width: 100%;
  }
}

.pending-filter-input {
  flex: 1;
  min-width: 0;
}

.pending-filter-input :deep(.el-input__wrapper) {
  border-radius: 10px;
}

.pending-filter-tags {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  max-width: 48%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;

  &::-webkit-scrollbar {
    height: 3px;
  }

  &::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 100px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 100px;
    background: #d1d5db;
  }
}

.pending-filter-btn {
  font-weight: 700;
  border-radius: 10px;
  flex-shrink: 0;
  margin: 0 !important;
}

.pending-filter-btn :deep(span) {
  padding: 7px 12px;
}

.pending-filter-btn.el-button--default {
  color: #374151 !important;
  background: #ffffff !important;
  border: 1px solid #d1d5db !important;

  &:hover {
    background: #f9fafb !important;
    border-color: #9ca3af !important;
    color: #111827 !important;
  }
}

.pending-filter-btn.el-button--primary {
  color: #fff !important;
  background: #9333ea !important;
  border: 1px solid #a855f7 !important;
  border-radius: 10px !important;
  box-shadow: 0 3px 2px rgba(147, 51, 234, 0.35);

  &:hover {
    background: #7e22ce !important;
    border-color: #c084fc !important;
  }
}

.pending-dialog-body {
  padding: 15px;
  height: 45vh;
  overflow-y: auto;
  overflow-x: hidden;
  background: #ffffff;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f3f4f6;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    margin: 4px 0;
    background: #f3f4f6;
    border-radius: 100px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 100px;
    background: #d1d5db;
    box-shadow: none;

    &:hover {
      background: #9ca3af;
    }
  }
}

.pending-task-item {
  position: relative;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px 14px 12px;
  margin-bottom: 10px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 3px 0 0 3px;
    opacity: 0.9;
  }

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  &--critical::before {
    background: linear-gradient(180deg, #fb7185, #be123c);
    box-shadow: 0 0 12px rgba(251, 113, 133, 0.35);
  }

  &--weak::before {
    background: linear-gradient(180deg, #a5b4fc, #6366f1);
    box-shadow: 0 0 12px rgba(165, 180, 252, 0.35);
  }

  &--port::before {
    background: linear-gradient(180deg, #fcd34d, #d97706);
    box-shadow: 0 0 12px rgba(252, 211, 77, 0.3);
  }
}

.pending-task-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.pending-task-item-head-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pending-task-category-pill {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #374151;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.pending-task-item--critical .pending-task-category-pill {
  color: #ce374a;
  background: rgba(244, 63, 94, 0.2);
  border-color: rgba(251, 113, 133, 0.35);
}

.pending-task-item--weak .pending-task-category-pill {
  color: #3a5dd2;
  background: rgba(99, 102, 241, 0.22);
  border-color: rgba(129, 140, 248, 0.4);
}

.pending-task-item--port .pending-task-category-pill {
  color: #cdaa1e;
  background: rgba(245, 158, 11, 0.18);
  border-color: rgba(251, 191, 36, 0.35);
}

.pending-task-item-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pending-task-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  padding: 10px 10px 12px;
  margin-bottom: 4px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
}

.pending-task-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pending-task-cell-label {
  font-size: 10px;
  font-weight: 700;
  color: #6b7280;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pending-task-cell-value {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  word-break: break-all;
  line-height: 1.4;
}

.pending-task-cell-value--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  color: #111827;
}

.pending-task-item-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.pending-task-govern-btn {
  font-weight: 700;
  border-radius: 10px;
  flex-shrink: 0;
  color: #fff !important;
  background: #9333ea !important;
  border: 1px solid #a855f7 !important;
  box-shadow: 0 8px 20px rgba(147, 51, 234, 0.35);

  &:hover {
    background: #7e22ce !important;
    border-color: #c084fc !important;
  }
}

.pending-dialog-empty {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
}
</style>

<style lang="scss">
.el-dialog.pending-tasks-list-dialog {
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.12);

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 20px;
    background: transparent;
  }
}

// body.pending-tasks-list-modal-open .v-modal,
// body.pending-tasks-list-modal-open .el-overlay {
//   background: transparent !important;
//   opacity: 0 !important;
//   backdrop-filter: none !important;
//   pointer-events: none !important;
// }
</style>