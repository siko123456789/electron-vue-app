<template>
  <!-- 服务收敛治理内容区 agent收敛 -->
  <div class="service-convergence-govern">
    <p class="service-convergence-govern__intro">
      针对异常暴露的服务进行访问控制与收敛，当前资产：{{ destIp || '--' }}（端口
      {{ destPort || '--' }}）
    </p>

    <!-- Agent 安装状态检测中 -->
    <div
      v-if="checkingAgentInstalled"
      class="service-convergence-govern__checking"
    >
      <LedgerLoading
        :visible="checkingAgentInstalled"
        text="正在检测 Agent 安装状态..."
      />
    </div>

    <!-- 未安装 Agent -->
    <el-card
      v-else-if="!hasInstalledAgent"
      shadow="never"
      class="service-convergence-govern__agent-card"
    >
      <div class="service-convergence-govern__agent-alert">
        <div class="service-convergence-govern__agent-alert-icon">
          <!-- <i class="el-icon-warning-outline" /> -->
          <el-icon><Warning /></el-icon>
        </div>
        <div class="service-convergence-govern__agent-alert-content">
          <div class="service-convergence-govern__agent-head">
            检测到当前资产未安装 Agent
          </div>
          <p class="service-convergence-govern__agent-desc">
            主机策略依赖 Agent 下发能力，请先完成 Agent
            安装后再进行服务收敛治理。
          </p>
        </div>
      </div>

      <el-form
        label-position="top"
        class="service-convergence-govern__agent-form"
        @submit.prevent
      >
        <el-form-item label="操作系统">
          <el-radio-group
            v-model="agentInstallForm.packageGroup"
            @change="refreshAgentInstallCommand"
          >
            <el-radio value="rpm">Linux x86_64</el-radio>
            <el-radio value="arm">Linux ARM</el-radio>
            <el-radio value="exe">Windows MSI</el-radio>
          </el-radio-group>
        </el-form-item>
        <div class="service-convergence-govern__agent-form-grid">
          <el-form-item label="Agent 服务器地址">
            <el-input
              v-model="agentInstallForm.host"
              placeholder="请输入服务器地址"
              clearable
              @blur="refreshAgentInstallCommand"
            />
          </el-form-item>
          <el-form-item label="Agent 名称">
            <div class="service-convergence-govern__agent-name-row">
              <el-input
                v-model="agentInstallForm.name"
                placeholder="请输入 Agent 名称"
                clearable
                @input="handleAgentNameInput"
                @blur="handleAgentNameBlur"
              />
              <div class="service-convergence-govern__name-status">
                <span
                  v-if="agentNameLoading"
                  class="service-convergence-govern__name-loading"
                >
                  <i class="service-convergence-govern__name-spinner" />
                  校验中
                </span>
                <span
                  v-else-if="agentNameStatus === 'error'"
                  class="service-convergence-govern__name-hint service-convergence-govern__name-hint--error"
                >
                  {{ agentNameHint }}
                </span>
                <span
                  v-else-if="agentNameStatus === 'success'"
                  class="service-convergence-govern__name-hint service-convergence-govern__name-hint--success"
                >
                  名称可用
                </span>
              </div>
            </div>
          </el-form-item>
        </div>
        <el-form-item label="组">
          <div class="service-convergence-govern__group-row">
            <el-select
              v-model="agentInstallForm.group"
              placeholder="请选择组"
              class="service-convergence-govern__group-select"
              @change="refreshAgentInstallCommand"
            >
              <el-option
                v-for="groupItem in agentGroupList"
                :key="groupItem.name"
                :label="groupItem.name"
                :value="groupItem.name"
              />
            </el-select>
            <el-button
              link
              class="service-convergence-govern__group-add-btn"
              @click="handleCreateAgentGroup"
            >
              <i class="el-icon-plus" />
              新增组
            </el-button>
          </div>
        </el-form-item>
      </el-form>

      <div class="service-convergence-govern__command-box">
        <div class="service-convergence-govern__command-head">
          <span>安装命令</span>
          <el-button link @click="handleCopyInstallCommand">
            复制
          </el-button>
        </div>
        <div class="service-convergence-govern__command-content">
          {{ agentInstallCommand || '请完整填写上方安装信息后生成命令' }}
        </div>
      </div>
    </el-card>

    <!-- 已安装 Agent：策略列表 + 访问关系 -->
    <div v-else class="service-convergence-govern__split">
      <div class="service-convergence-govern__split-main">
        <el-card shadow="never" class="service-convergence-govern__table-card">
          <div slot="header" class="service-convergence-govern__card-header">
            <span>策略列表</span>
          </div>

          <div class="service-convergence-govern__policy-body">
            <div class="service-convergence-govern__filter-row">
              <span class="service-convergence-govern__filter-label">源IP</span>
              <el-input
                v-model="manualRuleForm.sourceIp"
                placeholder="请输入源IP"
                class="service-convergence-govern__filter-input"
                clearable
              />
              <span class="service-convergence-govern__filter-label">类型</span>
              <el-select
                v-model="manualRuleForm.sourceType"
                placeholder="请选择类型"
                class="service-convergence-govern__filter-select"
                clearable
              >
                <el-option label="黑名单" value="Blacklist" />
                <el-option label="白名单" value="Whitelist" />
              </el-select>
              <el-button
                type="primary"
                size="small"
                :loading="manualDispatchLoading"
                @click="handleManualDispatch"
              >
                下发
              </el-button>
            </div>

            <div
              class="service-convergence-govern__table-wrap service-convergence-govern__table-wrap--policy"
            >
              <LedgerLoading
                :visible="hostPolicyLoading"
                text="加载策略列表..."
              />
              <el-table
                :data="hostPolicyRows"
                size="small"
                :height="tableFixedHeight"
                class="service-convergence-govern__table"
              >
                <el-table-column
                  prop="ip"
                  label="源IP"
                  min-width="100"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="port"
                  label="目的端口"
                  width="88"
                  show-overflow-tooltip
                />
                <el-table-column prop="protocol" label="协议" width="72" />
                <el-table-column label="动作" width="72">
                  <template #default="{ row }">
                    <span>
                      {{ formatRuleTypeText(row.ruleType || row.rule_type) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="方向" width="72">
                  <template #default="{ row }">
                    <span
                      v-if="
                        row.direction === 'incomming' ||
                        row.direction === 'outgoing'
                      "
                      class="service-convergence-govern__system-default-tag"
                    >
                      {{ formatDirectionText(row.direction) }}
                    </span>
                    <span v-else>—</span>
                  </template>
                </el-table-column>
                <template #empty>
                  <div class="ledger-table-empty-icon">
                    <i class="iconfont icon-kongzhuangtai"></i>
                    <span>暂无主机策略</span>
                  </div>
                </template>
              </el-table>
            </div>
          </div>
        </el-card>
      </div>

      <div class="service-convergence-govern__split-side">
        <el-card shadow="never" class="service-convergence-govern__table-card">
          <div slot="header" class="service-convergence-govern__card-header">
            <span>访问关系({{ mergedAccessRows.length }})</span>
          </div>

          <div class="service-convergence-govern__access-body">
            <div class="service-convergence-govern__table-wrap">
              <el-table
                ref="accessTableRef"
                :data="mergedAccessRows"
                :row-key="getAccessRowKey"
                size="small"
                :height="accessTableHeight"
                class="service-convergence-govern__table service-convergence-govern__table--access"
                @selection-change="handleAccessSelectionChange"
              >
                <el-table-column
                  type="selection"
                  width="48"
                  :selectable="isAccessRowSelectable"
                />
                <el-table-column prop="src_ip" label="源IP" min-width="110">
                  <template #default="{ row }">
                    <div
                      v-if="row.rowKind === 'previewAll'"
                      class="service-convergence-govern__access-src"
                    >
                      <span>{{ row.src_ip || 'all' }}</span>
                      <span
                        class="service-convergence-govern__system-default-tag"
                      >
                        系统默认
                      </span>
                    </div>
                    <span v-else class="service-convergence-govern__access-ip">
                      {{ row.src_ip || row.ip || '—' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="dest_ip"
                  label="目的IP"
                  min-width="100"
                />
                <el-table-column prop="dest_port" label="目的端口" width="80" />
                <template #empty>
                  <div class="ledger-table-empty-icon">
                    <i class="iconfont icon-kongzhuangtai"></i>
                    <span>暂无访问关系</span>
                  </div>
                </template>
              </el-table>
            </div>

            <div
              v-if="showConfirmDispatchButton"
              class="service-convergence-govern__access-footer"
            >
              <el-button
                type="primary"
                :loading="confirmDispatchLoading"
                @click="handleConfirmDispatch"
              >
                确认下发
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'

import {
  agentInstallAPI,
  agentIsInstalled,
  agentNameIsAvailableAPI,
  batchAgentRule,
  createGroup,
  groupList,
  queryAgentRule
} from '@/api/agent'
import { querySrcIpsByDestIpPortAPI } from '@/api/threaAssessment'
import { copyTextToClipboard } from '@/utils/copyToClipboard'
import LedgerLoading from '@/components/ledgerLoading.vue'

export default {
  name: 'ServiceConvergenceGovern',
  components: {
    LedgerLoading
  },
  props: {
    // 收敛上下文：资产 IP、端口等
    convergenceContext: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      checkingAgentInstalled: false,
      hasInstalledAgent: false,
      installedAgentId: '',
      hostPolicyRows: [],
      hostPolicyLoading: false,
      accessRelationList: [],
      selectedAccessRows: [],
      manualRuleForm: {
        sourceIp: '',
        sourceType: ''
      },
      manualDispatchLoading: false,
      confirmDispatchLoading: false,
      agentInstallForm: {
        packageGroup: 'rpm',
        host: window.location.host.split(':')[0],
        name: '',
        group: ''
      },
      agentGroupList: [],
      agentNameLoading: false,
      agentNameStatus: '',
      agentNameHint: '',
      agentInstallCommand: '',
      agentNameDebounceTimer: null,
      tableFixedHeight: 350,
      accessTableHeight: 350,
      isSyncingAccessSelection: false
    }
  },
  computed: {
    // 目的 IP
    destIp () {
      return String(this.convergenceContext.assetIp || '').trim()
    },
    // 目的端口
    destPort () {
      const portValue = Number(this.convergenceContext.port)
      return Number.isFinite(portValue) && portValue > 0 ? portValue : 443
    },
    // 访问关系展示行（含系统默认 all 行）
    mergedAccessRows () {
      const relationRows = (this.accessRelationList || []).map(
        (relationItem, relationIndex) => ({
          ...relationItem,
          rowKind: 'relation',
          rowKey: `relation-${relationIndex}-${
            relationItem.src_ip || relationItem.ip || ''
          }-${relationItem.dest_port || this.destPort}`
        })
      )
      if (!this.hasAllBlacklistRule()) {
        relationRows.push({
          src_ip: 'all',
          dest_ip: this.destIp,
          dest_port: this.destPort,
          rowKind: 'previewAll',
          rowKey: 'preview-all-blacklist'
        })
      }
      return relationRows
    },
    // 是否展示确认下发按钮
    showConfirmDispatchButton () {
      if (!this.hasInstalledAgent) {
        return false
      }
      if (!this.hasAllBlacklistRule()) {
        return true
      }
      const relationList = this.accessRelationList || []
      if (!relationList.length) {
        return false
      }
      return !relationList.every(relationItem =>
        this.isSrcIpInHostPolicy(relationItem.src_ip || relationItem.ip)
      )
    }
  },
  watch: {
    convergenceContext: {
      deep: true,
      handler () {
        this.initConvergenceData()
      }
    },
    mergedAccessRows: {
      deep: true,
      handler () {
        this.$nextTick(() => {
          this.$nextTick(() => {
            this.syncAccessTableSelection()
          })
        })
      }
    },
    hostPolicyRows: {
      deep: true,
      handler () {
        this.$nextTick(() => {
          this.$nextTick(() => {
            this.syncAccessTableSelection()
          })
        })
      }
    }
  },
  mounted () {
    this.initConvergenceData()
  },
  beforeUnmount () {
    if (this.agentNameDebounceTimer) {
      clearTimeout(this.agentNameDebounceTimer)
    }
  },
  methods: {
    // 返回漏洞列表
    handleBack () {
      this.$emit('back')
    },
    // 初始化收敛数据
    initConvergenceData () {
      this.fetchAgentInstallStatus()
    },
    // 查询 Agent 是否已安装
    async fetchAgentInstallStatus () {
      if (!this.destIp) {
        this.hasInstalledAgent = false
        this.installedAgentId = ''
        this.hostPolicyRows = []
        this.accessRelationList = []
        return
      }

      this.checkingAgentInstalled = true
      try {
        const response = await agentIsInstalled({
          condition: `ip=${this.destIp}`,
          currentPage: 1,
          pageSize: 99999
        })
        const agentList =
          response && response.data && Array.isArray(response.data.datas)
            ? response.data.datas
            : []
        const firstAgent = agentList[0] || null
        this.installedAgentId =
          firstAgent && firstAgent.id != null ? String(firstAgent.id) : ''
        this.hasInstalledAgent = Boolean(this.installedAgentId)

        if (this.hasInstalledAgent) {
          await Promise.all([
            this.fetchHostPolicyRows(),
            this.fetchAccessRelations()
          ])
        } else {
          this.hostPolicyRows = []
          this.accessRelationList = []
          this.selectedAccessRows = []
          this.fetchAgentGroupList()
        }
      } catch (error) {
        this.hasInstalledAgent = false
        this.installedAgentId = ''
        this.hostPolicyRows = []
        this.accessRelationList = []
        ElMessage.error('查询 Agent 安装状态失败')
      } finally {
        this.checkingAgentInstalled = false
        if (this.hasInstalledAgent) {
          this.$nextTick(() => {
            this.$nextTick(() => {
              this.syncAccessTableSelection()
            })
          })
        }
      }
    },
    // 查询主机策略列表
    async fetchHostPolicyRows () {
      if (!this.installedAgentId) {
        this.hostPolicyRows = []
        return
      }

      this.hostPolicyLoading = true
      try {
        const response = await queryAgentRule({
          cond: `agentId=${this.installedAgentId}andport=${this.destPort}`
        })
        const ruleList = Array.isArray(response)
          ? response
          : Array.isArray(response && response.data)
          ? response.data
          : Array.isArray(response && response.data && response.data.data)
          ? response.data.data
          : []
        this.hostPolicyRows = ruleList.map(ruleItem => {
          const ruleTypeRaw =
            ruleItem.ruleType || ruleItem.rule_type || ruleItem.rule || ''
          const normalizedRuleType = String(ruleTypeRaw).toLowerCase()
          return {
            ...ruleItem,
            port:
              ruleItem.port !== undefined && ruleItem.port !== null
                ? ruleItem.port
                : ruleItem.dst_port,
            ruleType:
              normalizedRuleType === 'whitelist'
                ? 'Whitelist'
                : normalizedRuleType === 'blacklist'
                ? 'Blacklist'
                : String(ruleTypeRaw).trim(),
            direction: String(
              ruleItem.direction || ruleItem.flow_direction || ''
            ).trim()
          }
        })
      } catch (error) {
        this.hostPolicyRows = []
        ElMessage.error('主机策略列表加载失败')
      } finally {
        this.hostPolicyLoading = false
      }
    },
    // 查询访问关系列表（querySrcIpsByDestIpPortAPI：传 dest_ip + dest_port）
    // 同接口还用于：AccessRelationDialog（资产端口）、AgentAccessRelationDialog（Agent，不传端口）
    async fetchAccessRelations () {
      if (!this.destIp) {
        this.accessRelationList = []
        return
      }

      try {
        const response = await querySrcIpsByDestIpPortAPI({
          dest_ip: this.destIp,
          dest_port: this.destPort,
          page: 1,
          page_size: 99999
        })
        const responseData =
          response && typeof response === 'object' ? response : {}
        const innerData =
          responseData.data != null && typeof responseData.data === 'object'
            ? responseData.data
            : responseData
        const itemList = Array.isArray(innerData.items)
          ? innerData.items
          : Array.isArray(innerData.src_ips)
          ? innerData.src_ips.map(srcIp => ({
              src_ip: srcIp,
              ip: srcIp,
              dest_ip: this.destIp,
              dest_port: this.destPort
            }))
          : []
        this.accessRelationList = itemList
        this.$nextTick(() => {
          this.syncAccessTableSelection()
        })
      } catch (error) {
        this.accessRelationList = []
        this.selectedAccessRows = []
        ElMessage.error('访问关系数据加载失败')
      }
    },
    // 策略列表中是否存在 all + 黑名单
    hasAllBlacklistRule () {
      return (this.hostPolicyRows || []).some(ruleItem => {
        const ipValue = String(ruleItem.ip || '')
          .trim()
          .toLowerCase()
        const portValue = Number(ruleItem.port)
        const ruleTypeValue = String(
          ruleItem.ruleType || ruleItem.rule_type || ''
        ).trim()
        return (
          ipValue === 'all' &&
          Number.isFinite(portValue) &&
          portValue === this.destPort &&
          ruleTypeValue === 'Blacklist'
        )
      })
    },
    // 源 IP 是否已在策略列表中
    isSrcIpInHostPolicy (sourceIp) {
      const normalizedSourceIp = String(sourceIp || '')
        .trim()
        .toLowerCase()
      if (!normalizedSourceIp) {
        return false
      }
      return (this.hostPolicyRows || []).some(ruleItem => {
        const ipValue = String(ruleItem.ip || '')
          .trim()
          .toLowerCase()
        const portValue = Number(ruleItem.port)
        return (
          ipValue === normalizedSourceIp &&
          Number.isFinite(portValue) &&
          portValue === this.destPort
        )
      })
    },
    // 访问关系行 key
    getAccessRowKey (row) {
      return (row && row.rowKey) || ''
    },
    // 访问关系行是否可选
    isAccessRowSelectable (row) {
      if (!row) {
        return false
      }
      if (row.rowKind === 'previewAll' && !this.hasAllBlacklistRule()) {
        return false
      }
      if (row.rowKind === 'relation') {
        return !this.isSrcIpInHostPolicy(row.src_ip || row.ip)
      }
      return true
    },
    // 是否固定勾选的访问关系行
    isAccessRowSelectionFixed (row) {
      if (!row) {
        return false
      }
      if (row.rowKind === 'previewAll' && !this.hasAllBlacklistRule()) {
        return true
      }
      return (
        row.rowKind === 'relation' &&
        this.isSrcIpInHostPolicy(row.src_ip || row.ip)
      )
    },
    // 同步访问关系表格勾选状态
    syncAccessTableSelection () {
      const accessTable = this.$refs.accessTableRef
      if (!accessTable || typeof accessTable.clearSelection !== 'function') {
        return
      }

      const tableRows = Array.isArray(accessTable.data)
        ? accessTable.data
        : this.mergedAccessRows

      const previousSelectedKeys = new Set(
        (this.selectedAccessRows || [])
          .filter(rowItem => !this.isAccessRowSelectionFixed(rowItem))
          .map(rowItem => this.getAccessRowKey(rowItem))
      )

      this.isSyncingAccessSelection = true
      accessTable.clearSelection()

      const nextSelectedRows = []
      tableRows.forEach(rowItem => {
        const rowKey = this.getAccessRowKey(rowItem)
        const shouldSelect =
          this.isAccessRowSelectionFixed(rowItem) ||
          previousSelectedKeys.has(rowKey)
        if (shouldSelect) {
          accessTable.toggleRowSelection(rowItem, true)
          nextSelectedRows.push(rowItem)
        }
      })

      this.selectedAccessRows = nextSelectedRows
      this.$nextTick(() => {
        this.isSyncingAccessSelection = false
      })
    },
    // 访问关系勾选变更
    handleAccessSelectionChange (selectedRows) {
      if (this.isSyncingAccessSelection) {
        return
      }

      const nextSelectedRows = Array.isArray(selectedRows) ? selectedRows : []
      const hasMissingFixedRow = this.mergedAccessRows.some(rowItem => {
        if (!this.isAccessRowSelectionFixed(rowItem)) {
          return false
        }
        return !nextSelectedRows.some(
          selectedItem =>
            this.getAccessRowKey(selectedItem) === this.getAccessRowKey(rowItem)
        )
      })

      this.selectedAccessRows = nextSelectedRows

      if (hasMissingFixedRow) {
        this.$nextTick(() => {
          this.syncAccessTableSelection()
        })
      }
    },
    // 根据勾选组装批量下发规则
    buildBatchRulesFromSelection () {
      const selectedRows = Array.isArray(this.selectedAccessRows)
        ? [...this.selectedAccessRows]
        : []

      if (!this.hasAllBlacklistRule()) {
        const previewAllRow = this.mergedAccessRows.find(
          rowItem => rowItem.rowKind === 'previewAll'
        )
        if (
          previewAllRow &&
          !selectedRows.some(
            rowItem =>
              this.getAccessRowKey(rowItem) ===
              this.getAccessRowKey(previewAllRow)
          )
        ) {
          selectedRows.push(previewAllRow)
        }
      }

      const ruleList = []
      selectedRows.forEach(rowItem => {
        if (rowItem.rowKind === 'previewAll') {
          ruleList.push({
            ip: 'all',
            port: this.destPort,
            protocol: 'tcp',
            ruleType: 'Blacklist',
            direction: 'incomming'
          })
          return
        }

        if (this.isSrcIpInHostPolicy(rowItem.src_ip || rowItem.ip)) {
          return
        }

        const sourceIp = String(rowItem.src_ip || rowItem.ip || '').trim()
        if (!sourceIp) {
          return
        }

        ruleList.push({
          ip: sourceIp,
          port: this.destPort,
          protocol: 'tcp',
          ruleType: 'Whitelist',
          direction: 'incomming'
        })
      })

      const uniqueRuleMap = new Map()
      ruleList.forEach(ruleItem => {
        const uniqueKey = [
          String(ruleItem.ip || '')
            .trim()
            .toLowerCase(),
          String(ruleItem.port),
          String(ruleItem.protocol || '')
            .trim()
            .toLowerCase(),
          String(ruleItem.ruleType || '').trim(),
          String(ruleItem.direction || '').trim()
        ].join('|')
        if (!uniqueRuleMap.has(uniqueKey)) {
          uniqueRuleMap.set(uniqueKey, ruleItem)
        }
      })
      return Array.from(uniqueRuleMap.values())
    },
    // 批量下发 Agent 规则
    async submitBatchRules (ruleList) {
      const response = await batchAgentRule({
        ip: this.destIp,
        batchAddRuleRequest: {
          agentId: this.installedAgentId,
          rules: ruleList.map(ruleItem => ({
            ip: String(ruleItem.ip || '').trim(),
            port: Number(ruleItem.port),
            protocol: String(ruleItem.protocol || 'tcp').trim(),
            rule_type: String(ruleItem.ruleType || 'Blacklist').trim(),
            direction: String(ruleItem.direction || 'incomming').trim()
          }))
        }
      })
      if (!response || Number(response.code) !== 0) {
        throw new Error((response && response.msg) || '策略下发失败')
      }
      return response
    },
    // 策略列表手动下发
    async handleManualDispatch () {
      if (!this.manualRuleForm.sourceIp) {
        ElMessage.warning('请填写源IP')
        return
      }
      if (!this.manualRuleForm.sourceType) {
        ElMessage.warning('请选择类型')
        return
      }
      if (!this.installedAgentId) {
        ElMessage.warning('请先部署 Agent')
        return
      }

      this.manualDispatchLoading = true
      try {
        const response = await this.submitBatchRules([
          {
            ip: this.manualRuleForm.sourceIp,
            port: this.destPort,
            protocol: 'tcp',
            ruleType: this.manualRuleForm.sourceType,
            direction: 'incomming'
          }
        ])
        ElMessage.success(response.msg || '策略下发成功')
        this.manualRuleForm.sourceIp = ''
        this.manualRuleForm.sourceType = ''
        this.$emit('success', {
          action: 'manual-dispatch',
          message: response.msg || '策略下发成功'
        })
        await Promise.all([
          this.fetchHostPolicyRows(),
          this.fetchAccessRelations()
        ])
      } catch (error) {
        ElMessage.error(error.message || '策略下发失败')
      } finally {
        this.manualDispatchLoading = false
      }
    },
    // 访问关系确认下发
    async handleConfirmDispatch () {
      const batchRules = this.buildBatchRulesFromSelection()
      if (!batchRules.length) {
        ElMessage.warning('请先勾选访问关系后再确认下发')
        return
      }

      this.confirmDispatchLoading = true
      try {
        const response = await this.submitBatchRules(batchRules)
        ElMessage.success(response.msg || '确认下发成功')
        this.$emit('success', {
          action: 'confirm-dispatch',
          message: response.msg || '确认下发成功'
        })
        await Promise.all([
          this.fetchHostPolicyRows(),
          this.fetchAccessRelations()
        ])
      } catch (error) {
        ElMessage.error(error.message || '确认下发失败')
      } finally {
        this.confirmDispatchLoading = false
      }
    },
    // 格式化动作文案
    formatRuleTypeText (ruleType) {
      return String(ruleType || '').toLowerCase() === 'blacklist'
        ? '拒绝'
        : '允许'
    },
    // 格式化方向文案
    formatDirectionText (direction) {
      if (direction === 'incomming') {
        return '入站'
      }
      if (direction === 'outgoing') {
        return '出站'
      }
      return '—'
    },
    // 查询 Agent 组列表
    async fetchAgentGroupList () {
      try {
        const response = await groupList()
        this.agentGroupList =
          response && response.data && response.data.datas
            ? response.data.datas
            : []
      } catch (error) {
        this.agentGroupList = []
      }
    },
    // Agent 名称输入防抖校验
    handleAgentNameInput () {
      if (this.agentNameDebounceTimer) {
        clearTimeout(this.agentNameDebounceTimer)
      }
      this.agentNameDebounceTimer = setTimeout(() => {
        this.checkAgentNameAvailable()
      }, 500)
    },
    // Agent 名称失焦校验
    handleAgentNameBlur () {
      if (this.agentNameDebounceTimer) {
        clearTimeout(this.agentNameDebounceTimer)
      }
      this.checkAgentNameAvailable()
    },
    // 校验 Agent 名称是否可用
    async checkAgentNameAvailable () {
      const agentName = String(this.agentInstallForm.name || '').trim()
      if (!agentName) {
        this.agentNameStatus = ''
        this.agentNameHint = ''
        this.agentInstallCommand = ''
        return
      }

      this.agentNameLoading = true
      this.agentNameStatus = ''
      try {
        const response = await agentNameIsAvailableAPI({ name: agentName })
        const availableCount =
          response && response.data !== undefined ? Number(response.data) : 1
        if (availableCount > 0) {
          this.agentNameStatus = 'error'
          this.agentNameHint = '名称不可用'
        } else {
          this.agentNameStatus = 'success'
          this.agentNameHint = ''
        }
      } catch (error) {
        this.agentNameStatus = 'error'
        this.agentNameHint = '名称校验失败'
      } finally {
        this.agentNameLoading = false
        this.refreshAgentInstallCommand()
      }
    },
    // 刷新 Agent 安装命令
    async refreshAgentInstallCommand () {
      const packageGroup = String(
        this.agentInstallForm.packageGroup || ''
      ).trim()
      const host = String(this.agentInstallForm.host || '').trim()
      const name = String(this.agentInstallForm.name || '').trim()
      const groupName = String(this.agentInstallForm.group || '').trim()

      if (
        !packageGroup ||
        !host ||
        !name ||
        !groupName ||
        this.agentNameLoading ||
        this.agentNameStatus !== 'success'
      ) {
        this.agentInstallCommand = ''
        return
      }

      try {
        const response = await agentInstallAPI({
          os: packageGroup,
          host,
          name,
          group: groupName
        })
        this.agentInstallCommand =
          response && response.data && response.data.install
            ? response.data.install
            : ''
      } catch (error) {
        this.agentInstallCommand = ''
      }
    },
    // 新增 Agent 组
    handleCreateAgentGroup () {
      this.$prompt('请输入组名（仅支持中文和英文字母）', '创建组', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^[a-zA-Z\u4e00-\u9fa5]+$/,
        inputErrorMessage: '组名只能包含中文或英文字母'
      })
        .then(async ({ value }) => {
          const groupName = String(value || '').trim()
          if (!groupName) {
            ElMessage.error('组名不能为空')
            return
          }
          const response = await createGroup({ group_id: groupName })
          ElMessage.success((response && response.msg) || '创建成功')
          this.fetchAgentGroupList()
        })
        .catch(() => {})
    },
    // 复制 Agent 安装命令
    async handleCopyInstallCommand () {
      const installCommand = String(this.agentInstallCommand || '').trim()
      if (!installCommand) {
        ElMessage.warning('暂无可复制的安装命令')
        return
      }
      try {
        const copySuccess = await copyTextToClipboard(installCommand)
        if (copySuccess) {
          ElMessage.success('复制成功')
          return
        }
        ElMessage.error('复制失败')
      } catch (error) {
        ElMessage.error('复制失败')
      }
    }
  }
}
</script>

<style scoped lang="scss">
.service-convergence-govern {
  &__intro {
    margin: 0 0 var(--sp-4);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  &__checking {
    position: relative;
    min-height: 220px;
  }

  &__agent-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;

    .el-input {
      flex: 1;
      min-width: 0;
    }
  }

  &__name-status {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    min-width: 64px;
    min-height: 32px;
  }

  &__name-loading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1;
    white-space: nowrap;
  }

  &__name-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--c-border);
    border-top-color: var(--c-primary);
    border-radius: 50%;
    animation: service-convergence-name-spin 0.8s linear infinite;
  }

  &__agent-card {
    overflow: hidden;
    border-radius: var(--r-lg);
    background: var(--c-bg-card);

    ::v-deep .el-card__body {
      padding: var(--sp-4);
    }
  }

  &__agent-alert {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid rgba(251, 191, 36, 0.28);
    border-radius: var(--r-md);
    background: rgba(251, 191, 36, 0.08);
  }

  &__agent-alert-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    color: var(--c-warn);
    font-size: 18px;
    border-radius: 50%;
    background: rgba(251, 191, 36, 0.15);
  }

  &__agent-alert-content {
    flex: 1;
    min-width: 0;
  }

  &__agent-head {
    margin-bottom: 4px;
    color: var(--c-warn);
    font-size: var(--fs-md);
    font-weight: var(--fw-medium);
    line-height: 1.4;
  }

  &__agent-desc {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  &__agent-form {
    ::v-deep .el-form-item {
      margin-bottom: var(--sp-4);
    }

    ::v-deep .el-form-item__label {
      padding-bottom: 6px;
      color: var(--c-text-secondary);
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
      line-height: 1.4;
    }

    ::v-deep .el-form-item__content {
      display: flex;
      align-items: center;
      min-height: 32px;
      line-height: 32px;
    }

    ::v-deep .el-radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
    }

    ::v-deep .el-radio {
      margin-right: 0;
    }
  }

  &__agent-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 var(--sp-4);
    align-items: start;

    ::v-deep .el-form-item {
      margin-bottom: var(--sp-4);
    }
  }

  &__name-hint {
    font-size: var(--fs-xs);
    line-height: 1;
    white-space: nowrap;

    &--error {
      color: var(--c-danger);
    }

    &--success {
      color: var(--c-success);
    }
  }

  &__group-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  &__group-select {
    flex: 1;
    min-width: 0;

    ::v-deep .el-select__wrapper {
      min-height: 32px;
      height: 32px;
    }
  }

  &__group-add-btn {
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    height: 32px;

    i {
      margin-right: 2px;
    }
  }

  &__command-box {
    margin-top: var(--sp-3);
    overflow: hidden;
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    background: var(--c-bg-hover);
  }

  &__command-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--c-border-light);
    color: var(--c-text-secondary);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
  }

  &__command-content {
    padding: var(--sp-3);
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.6;
    word-break: break-all;
  }

  &__split {
    display: flex;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 16px;
    min-width: 0;
  }

  &__split-main {
    display: flex;
    min-width: 0;
    flex: 0 0 58%;
    max-width: 58%;
  }

  &__split-side {
    display: flex;
    min-width: 0;
    flex: 0 0 calc(42% - 16px);
    max-width: calc(42% - 16px);
  }

  &__table-card {
    display: flex;
    width: 100%;
    min-height: 332px;
    height: 100%;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: none;

    ::v-deep .el-card__header {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      height: 44px;
      min-height: 44px;
      padding: 0 14px;
      flex-shrink: 0;
      border-bottom: 1px solid #f3f4f6;
      background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
    }

    ::v-deep .el-card__body {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      padding: 0;
    }
  }

  &__policy-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  &__card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    color: #111827;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;

    span {
      line-height: 1.2;
    }
  }

  &__filter-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    min-height: 50px;
    padding: 0 14px;
    flex-shrink: 0;
  }

  &__filter-label {
    flex-shrink: 0;
    margin-right: 8px;
    color: #4b5563;
    font-size: 12px;
    white-space: nowrap;
  }

  &__filter-input {
    width: 150px;
    margin-right: 20px;
    flex-shrink: 0;
  }

  &__filter-select {
    width: 150px;
    margin-right: 20px;
    flex-shrink: 0;
  }

  ::v-deep &__filter-input .el-input__inner,
  ::v-deep &__filter-select .el-input__inner {
    height: 30px;
    line-height: 30px;
    font-size: 12px;
    background: #ffffff;
    border-color: #dcdfe6;
    border-radius: 4px;
  }

  ::v-deep &__filter-select .el-input__icon {
    line-height: 30px;
  }

  &__access-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  &__table-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;

    &--policy {
      padding: 0;
    }
  }

  &__system-default-tag {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    height: 20px;
    padding: 0 6px;
    color: var(--c-system-default-tag-color);
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    white-space: nowrap;
    background: var(--c-system-default-tag-bg);
    border: 1px solid var(--c-system-default-tag-border);
    border-radius: 3px;
  }

  &__access-src {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  &__access-ip {
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }

  &__access-footer {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
    padding: 10px 12px 12px;
    border-top: 1px solid #f3f4f6;
  }

  ::v-deep .service-convergence-govern__table {
    width: 100% !important;
    color: #4b5563;
    font-size: 12px;
    background: transparent;

    &::before {
      display: none;
    }

    th {
      padding: 8px 0;
      color: #4b5563;
      font-size: 12px;
      font-weight: 700;
      background: #f9fafb;
    }

    td {
      padding: 8px 0;
      color: #4b5563;
      font-size: 12px;
      background: transparent;
    }

    tr {
      background: transparent;
    }

    .el-table__empty-block {
      min-height: 180px;
    }

    .el-table__empty-text {
      color: var(--c-text-muted);
      font-size: var(--fs-sm);
    }

    .el-table__body-wrapper {
      scrollbar-width: thin;
      scrollbar-color: rgba(124, 58, 237, 0.32) #f1f5f9;

      &::-webkit-scrollbar {
        width: 3px;
        height: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(124, 58, 237, 0.38);
        border-radius: 4px;
      }

      &::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 4px;
      }
    }
  }

  ::v-deep .service-convergence-govern__table--access {
    .el-table {
      table-layout: auto;
    }

    .el-table-column--selection .cell {
      overflow: visible;
      text-overflow: clip;
    }

    .el-table__body-wrapper,
    .el-table__header-wrapper {
      overflow-x: hidden !important;
    }

    .el-checkbox__input.is-disabled.is-checked .el-checkbox__inner {
      background-color: var(--accent);
      border-color: var(--accent);
      opacity: 0.72;
    }

    .el-checkbox__input.is-disabled.is-checked .el-checkbox__inner::after {
      border-color: #ffffff;
    }

    .el-checkbox__input.is-disabled .el-checkbox__inner {
      cursor: not-allowed;
    }
  }

  @media (max-width: 768px) {
    &__agent-form-grid {
      grid-template-columns: 1fr;
    }

    &__split {
      flex-direction: column;
    }

    &__split-main,
    &__split-side {
      flex: 1 1 auto;
      max-width: 100%;
    }

    &__filter-row {
      flex-wrap: wrap;
    }
  }
}

@keyframes service-convergence-name-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style lang="scss">
:root[data-theme='light'] {
  .service-convergence-govern__agent-card {
    background: #ffffff;
    border-color: rgba(251, 191, 36, 0.45);
  }

  .service-convergence-govern__agent-alert {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.35);
  }

  .service-convergence-govern__table-card {
    background: #ffffff;
    border-color: #e5e7eb;
  }
}

:root[data-theme='dark'] {
  .service-convergence-govern__table-card {
    background: var(--c-bg-card);
    border-color: var(--c-border);

    .el-card__header {
      background: linear-gradient(
        180deg,
        var(--c-bg-hover) 0%,
        var(--c-bg-card) 100%
      );
      border-bottom-color: var(--c-border-light);
    }
  }

  .service-convergence-govern__card-header {
    color: var(--c-text);
  }

  .service-convergence-govern__filter-label {
    color: var(--c-text-muted);
  }

  .service-convergence-govern__filter-input .el-input__inner,
  .service-convergence-govern__filter-select .el-input__inner {
    background: var(--c-bg-input);
    border-color: var(--c-border);
  }

  .service-convergence-govern__table th {
    background: var(--c-bg-hover);
    color: var(--c-text-secondary);
  }

  .service-convergence-govern__table td {
    color: var(--c-text-secondary);
  }

  .service-convergence-govern__access-footer {
    border-top-color: var(--c-border-light);
  }
}
</style>
