<template>
  <!-- 服务收敛治理区 -->
  <div
    class="service-convergence-panel"
    :class="{ 'service-convergence-panel--embedded': embedded }"
  >
    <p v-if="subtitleText" class="service-convergence-lead">
      {{ subtitleText }}
    </p>

    <!-- 治理类型：单选卡片 -->
    <div class="policy-type-cards">
      <!-- <el-card
        shadow="never"
        class="policy-type-card"
        :class="{ 'is-active': policyType === 'bypass' }"
        @click.native="policyType = 'bypass'"
      >
        <div class="policy-type-card-head">
          <div
            class="policy-type-icon-wrap"
            :class="{ 'is-active': policyType === 'bypass' }"
          >
            <i class="el-icon-share"></i>
          </div>
          <div class="policy-type-card-text">
            <div class="policy-type-title">旁路策略</div>
            <p class="policy-type-desc">通过旁路阻断进行收敛</p>
          </div>
          <el-radio
            v-model="policyType"
            label="bypass"
            class="policy-type-radio"
            @click.native.stop
          />
        </div>
      </el-card>-->
      <el-card
        shadow="never"
        class="policy-type-card"
        :class="{ 'is-active': policyType === 'host' }"
        @click="policyType = 'host'"
      >
        <div class="policy-type-card-head">
          <div
            class="policy-type-icon-wrap"
            :class="{ 'is-active': policyType === 'host' }"
          >
            <i class="el-icon-lock"></i>
          </div>
          <div class="policy-type-card-text">
            <div class="policy-type-title">主机策略</div>
            <p class="policy-type-desc">通过主机 Agent 进行管控</p>
          </div>
          <el-radio
            v-model="policyType"
            label="host"
            class="policy-type-radio"
            @click.stop
          />
        </div>
      </el-card>
    </div>

    <!-- 源 IP：放在治理方式与列表之间，作为提交前必填项 -->
    <!-- <el-card shadow="never" class="service-convergence-source-card">
      <div class="service-convergence-source-card-head">
        <i class="el-icon-aim"></i>
        <span class="service-convergence-source-card-title">收敛对象</span>
        <el-tooltip
          content="填写需要纳入本次策略优化的源 IP，确认优化前将校验此项"
          placement="top"
        >
          <i class="el-icon-info service-convergence-source-hint-icon"></i>
        </el-tooltip>
      </div>
      <el-form
        class="service-convergence-source-form"
        label-position="top"
        size="small"
        @submit.native.prevent
      >
        <el-form-item label="源 IP" required>
          <el-input
            v-model="sourceIpInput"
            placeholder="请输入 IPv4 地址，例如 10.10.10.10"
            clearable
          />
        </el-form-item>
      </el-form>
    </el-card>-->

    <!-- Agent 安装状态检测中：仅展示 loading，避免先闪表格再切安装页 -->
    <div
      v-if="policyType === 'host' && checkingAgentInstalled"
      class="service-convergence-agent-checking"
    >
      <el-card
        shadow="never"
        class="service-convergence-agent-checking-card"
        v-loading="true"
        element-loading-text="正在检测 Agent 安装状态..."
        element-loading-spinner="el-icon-loading"
      >
        <div class="service-convergence-agent-checking-placeholder" />
      </el-card>
    </div>

    <div
      v-else-if="policyType === 'host' && !hasInstalledAgent"
      class="service-convergence-agent-empty"
    >
      <el-card shadow="never" class="service-convergence-agent-empty-card">
        <div class="service-convergence-agent-empty-head">
          <i class="el-icon-warning-outline"></i>
          <span>检测到当前资产未安装 Agent</span>
        </div>
        <p class="service-convergence-agent-empty-desc">
          主机策略依赖 Agent 下发能力，请先完成 Agent 安装后再进行服务收敛治理。
        </p>
        <div class="service-convergence-agent-form">
          <el-form label-position="top" size="small" @submit.prevent>
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
            <el-form-item label="Agent 服务器地址">
              <el-input
                v-model="agentInstallForm.host"
                placeholder="请输入服务器地址"
                clearable
                @blur="refreshAgentInstallCommand"
                @keyup.enter="refreshAgentInstallCommand"
              />
            </el-form-item>
            <el-form-item label="Agent 名称">
              <el-input
                v-model="agentInstallForm.name"
                :disabled="agentNameLoading"
                placeholder="请输入 Agent 名称"
                clearable
                @input="handleAgentNameInput"
                @blur="handleAgentNameBlur"
              >
                  <template #suffix>
                  <i v-if="agentNameLoading" class="el-icon-loading"></i>
                  <i
                    v-else-if="agentNameStatus === 'success'"
                    class="el-icon-success"
                    style="color: #67c23a"
                  ></i>
                  <i
                    v-else-if="agentNameStatus === 'error'"
                    class="el-icon-error"
                    style="color: #f56c6c"
                  ></i>
                </template>
              </el-input>
              <div
                v-if="agentNameStatus === 'error'"
                class="service-convergence-agent-name-hint is-error"
              >
                {{ agentNameHint }}
              </div>
              <div
                v-else-if="agentNameStatus === 'success'"
                class="service-convergence-agent-name-hint is-success"
              >
                名称可用
              </div>
            </el-form-item>
            <el-form-item label="组">
              <div class="service-convergence-agent-group-row">
                <el-select
                  v-model="agentInstallForm.group"
                  placeholder="请选择组"
                  class="service-convergence-agent-group-select"
                  @change="refreshAgentInstallCommand"
                >
                  <el-option
                    v-for="(groupItem, groupIndex) in agentInstallGroupList"
                    :key="groupIndex"
                    :label="groupItem.name"
                    :value="groupItem.name"
                  />
                </el-select>
                <el-button link @click="createAgentGroup"
                  >新增组</el-button
                >
              </div>
            </el-form-item>
          </el-form>
          <div class="service-convergence-agent-command-box">
            <div class="service-convergence-agent-command-head">
              <span>安装命令</span>
              <el-button link @click="copyAgentInstallCommand"
                >复制</el-button
              >
            </div>
            <div class="service-convergence-agent-command-content">
              {{ agentInstallCommand || '请完整填写上方安装信息后生成命令' }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 底部：左访问关系 + 右策略列表 / 待下发策略预览 -->
    <el-row v-else :gutter="16" class="service-convergence-split">
      <!-- 待下发策略预览区（首次确认优化仅预览，不调接口） -->
      <el-col v-if="issuePreviewVisible" :span="24">
        <el-card shadow="never" class="service-convergence-table-card">
          <template #header>
            <div class="service-convergence-card-header">
            <div>
              <i class="el-icon-view"></i>
              <span>待下发策略预览</span>
            </div>
            <div>
              <el-button size="small" @click="exitIssuePreview">返回</el-button>
            </div>
            </div>
          </template>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="service-convergence-preview-alert"
            :title="issuePreviewAlertTitle"
          />

          <el-table
            :data="issuePreviewRows"
            size="small"
            border
            stripe
            :height="tableBodyFixedHeight"
            empty-text="暂无待下发策略"
            class="service-convergence-table"
          >
            <el-table-column
              prop="ip"
              label="源IP"
              width="160"
              fixed="left"
              show-overflow-tooltip
            >
              <template #header>
                <span>源IP</span>
              </template>
              <template #default="{ row }">
                <div class="service-convergence-preview-ip-cell">
                  <span class="service-convergence-preview-ip-text">
                    {{ row && row.ip ? row.ip : '—' }}
                  </span>
                  <el-tag
                    v-if="row && row.__from === 'access'"
                    size="small"
                    type="success"
                    effect="plain"
                    class="service-convergence-preview-source-tag"
                    >用户勾选</el-tag
                  >
                  <el-tag
                    v-else-if="row && row.__from === 'auto_all_blacklist'"
                    size="small"
                    type="info"
                    effect="plain"
                    class="service-convergence-preview-source-tag"
                    >系统默认</el-tag
                  >
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="port" label="目的端口" min-width="110" />
            <el-table-column prop="protocol" label="协议" min-width="90" />
            <el-table-column prop="ruleType" label="动作" min-width="90">
              <template #default="{ row }">
                {{ row.ruleType === 'Blacklist' ? '拒绝' : '允许' }}
              </template>
            </el-table-column>
            <el-table-column label="方向" min-width="90">
              <template #default="{ row }">
                <el-tag
                  v-if="row.direction === 'incomming'"
                  size="small"
                  type="info"
                  effect="plain"
                  >入站</el-tag
                >
                <el-tag
                  v-else-if="row.direction === 'outgoing'"
                  size="small"
                  type="warning"
                  effect="plain"
                  >出站</el-tag
                >
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="90" align="center">
              <template #default="{ $index }">
                <el-button
                  link
                  size="small"
                  @click="removeIssuePreviewRow($index)"
                  >删除</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col v-else :xs="24" :sm="24" :md="10" :lg="10">
        <el-card shadow="never" class="service-convergence-table-card">
          <template #header>
            <div class="service-convergence-card-header">
            <i class="el-icon-connection"></i>
            <span>访问关系({{ accessRelationshipTotal }})</span>
            </div>
          </template>
          <el-table
            ref="accessRelationTableRef"
            :data="accessRelationshipList"
            size="small"
            border
            stripe
            :height="392"
            empty-text="暂无访问关系"
            class="service-convergence-table"
            @selection-change="handleAccessSelectionChange"
          >
            <el-table-column type="selection" width="46" />
            <el-table-column
              prop="src_ip"
              label="源IP"
              min-width="110"
              show-overflow-tooltip
            />
            <el-table-column
              prop="dest_ip"
              label="目的IP"
              min-width="110"
              show-overflow-tooltip
            />
            <el-table-column prop="dest_port" label="目的端口" width="100" />
            <!-- <el-table-column
              prop="first_seen"
              label="首次出现时间"
              width="72"
            />
            <el-table-column
              prop="last_seen"
              label="最后出现时间"
              width="100"
            />-->
          </el-table>
        </el-card>
      </el-col>

      <el-col v-if="!issuePreviewVisible" :xs="24" :sm="24" :md="14" :lg="14">
        <el-card shadow="never" class="service-convergence-table-card">
          <template #header>
            <div class="service-convergence-card-header">
            <i class="el-icon-document"></i>
            <span>策略列表</span>
            </div>
          </template>
          <div class="form_line">
            <span class="label">源IP</span>
            <el-input
              v-model="sourceIp"
              placeholder="请输入源IP"
              style="width: 150px; margin-right: 20px"
            />

            <span class="label">类型</span>
            <el-select
              v-model="sourceType"
              placeholder="请选择类型"
              style="width: 150px; margin-right: 20px"
            >
              <el-option label="黑名单" value="Blacklist" />
              <el-option label="白名单" value="Whitelist" />
            </el-select>
            <el-button
              type="primary"
              class="primary-class"
              @click="handleSubmit"
              >下发</el-button
            >
          </div>
          <!-- 旁路策略 -->
          <!-- <el-table
            v-if="policyType === 'bypass'"
            :data="bypassPolicyRows"
            v-loading="bypassPolicyLoading"
            size="small"
            border
            stripe
            :height="tableBodyFixedHeight"
            empty-text="暂无旁路策略"
            class="service-convergence-table service-convergence-table--bypass"
          >
            <el-table-column
              prop="msg"
              label="名称"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column prop="protocol" label="协议" width="72" />
            <el-table-column
              prop="src_addr"
              label="源地址"
              min-width="108"
              show-overflow-tooltip
            />
            <el-table-column
              prop="dst_addr"
              label="目的地址"
              min-width="108"
              show-overflow-tooltip
            />
            <el-table-column label="目的端口" width="96">
              <template #default="{ row }">
                <el-tag
                  v-if="row.dst_port != null && row.dst_port !== ''"
                  size="mini"
                  type="info"
                  effect="plain"
                  class="service-convergence-port-tag"
                >
                  {{ row.dst_port }}
                </el-tag>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="动作" width="72" align="center">
              <template #default="{ row }">
                <el-tooltip
                  content="告警"
                  v-if="row.action === 'alert'"
                  placement="top"
                >
                  <i
                    class="iconfont icon-warning service-convergence-action-icon--alert"
                  ></i>
                </el-tooltip>
                <el-tooltip
                  content="允许"
                  v-else-if="row.action === 'pass'"
                  placement="top"
                >
                  <i
                    class="iconfont icon-chenggong service-convergence-action-icon--pass"
                  ></i>
                </el-tooltip>
                <el-tooltip
                  content="拒绝"
                  v-else-if="row.action === 'reject'"
                  placement="top"
                >
                  <i
                    class="iconfont icon-shibai service-convergence-action-icon--reject"
                  ></i>
                </el-tooltip>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="下发状态" width="100">
              <template #default="{ row }">
                <div class="service-convergence-deliver-wrap">
                  <i
                    class="iconfont"
                    :class="row.enable ? 'icon-yixiafa' : 'icon-weixiafa'"
                    :style="
                      row.enable
                        ? 'font-size:10px;color:var(--default-color);margin-right:6px'
                        : 'font-size:13px;color:#E88439;margin:2px 6px 0 0'
                    "
                  ></i>
                  <span
                    :style="
                      row.enable
                        ? 'font-size:12px;color:var(--default-color)'
                        : 'font-size:12px;color:#E88439'
                    "
                  >
                    {{ row.enable ? '已下发' : '未下发' }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="应用规则" width="100">
              <template #default="{ row }">
                <div style="display: flex; align-items: center">
                  <span
                    :style="{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: row.apply ? '#83CE39' : '#999999',
                      marginRight: '6px'
                    }"
                  ></span>
                  <span>{{ row.apply ? '已应用' : '未应用' }}</span>
                </div>
              </template>
            </el-table-column>
          </el-table>-->

          <!-- 主机策略   v-else-->
          <el-table
            :data="hostPolicyRows"
            v-loading="hostPolicyLoading"
            size="small"
            border
            stripe
            :height="tableBodyFixedHeight"
            empty-text="暂无主机策略"
            class="service-convergence-table"
          >
            <el-table-column
              prop="ip"
              label="源IP"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column prop="port" label="目的端口" width="88">
              <template #default="{ row }">
                {{ row.port || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="protocol" label="协议" width="80" />
            <el-table-column
              prop="ruleType"
              label="动作"
              min-width="120"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{
                  (row.ruleType || row.rule_type) === 'Blacklist'
                    ? '拒绝'
                    : '允许'
                }}
              </template>
            </el-table-column>
            <el-table-column label="方向">
              <template #default="{ row }">
                <el-tag
                  v-if="row.direction == 'incomming'"
                  size="mini"
                  type="info"
                  effect="plain"
                  class="service-convergence-host-direction-tag"
                  >入站</el-tag
                >
                <el-tag
                  v-else-if="row.direction == 'outgoing'"
                  size="mini"
                  type="warning"
                  effect="plain"
                  class="service-convergence-host-direction-tag"
                  >出站</el-tag
                >
                <span v-else>—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="ts">
// @ts-nocheck
import {
  queryPolicyList,
  querySrcIpsByDestIpPortAPI
} from '@/api/threaAssessment'
import {
  agentInstallAPI,
  batchAgentRule,
  agentIsInstalled,
  agentNameIsAvailableAPI,
  createGroup as createAgentGroupAPI,
  groupList as queryAgentGroupList,
  queryAgentRule
} from '@/api/agent'

/**
 * 服务收敛治理内容区：可嵌入风险详情等弹框，与 ServiceConvergenceDialog 共用
 */
export default {
  name: 'ServiceConvergencePanel',
  props: {
    /** 为 true 时表示嵌在父级 el-dialog 内，仅用于样式微调 */
    embedded: {
      type: Boolean,
      default: false
    },
    /** 可选：由父组件传入的访问关系数据（非空则优先展示） */
    accessRelations: {
      type: Array,
      default: null
    },
    /** 资产摘要文案（可选） */
    assetSummary: {
      type: String,
      default: ''
    },
    /** 收敛上下文（来自风险详情弹框，包含 item/taskData 等真实数据） */
    convergenceContext: {
      type: Object,
      default: null
    }
  },
  data () {
    return {
      policyType: 'host', // bypass（旁路策略）host（主机策略）
      accessRelationshipList: [], // 访问关系
      accessRelationshipTotal: 0, // 访问关系总数
      /** 旁路策略列表 */
      bypassPolicyRows: [],
      /** 旁路策略列表加载状态 */
      bypassPolicyLoading: false,
      /** 主机策略列表 */
      hostPolicyRows: [],
      /** 主机策略列表加载状态 */
      hostPolicyLoading: false,
      /** 是否安装 Agent */
      hasInstalledAgent: false,
      /** Agent 检测中 */
      checkingAgentInstalled: false,
      /** 当前资产 Agent ID */
      installedAgentId: '',
      /** 访问关系勾选行 */
      selectedAccessRows: [],
      /** 待下发策略预览区是否显示（确认优化前） */
      issuePreviewVisible: false,
      /** 待下发策略预览数据（前端临时，不调用接口新增） */
      issuePreviewRows: [],
      /** 预览对应的端口（当前端口） */
      issuePreviewPort: '',
      /** 内嵌 Agent 安装表单 */
      agentInstallForm: {
        packageGroup: 'rpm',
        host: location.host.split(':')[0],
        name: '',
        group: ''
      },
      /** 组列表 */
      agentInstallGroupList: [],
      /** 名称校验加载状态 */
      agentNameLoading: false,
      /** 名称校验状态 */
      agentNameStatus: '',
      /** 名称校验提示 */
      agentNameHint: '',
      /** 安装命令 */
      agentInstallCommand: '',
      /** 名称输入防抖 */
      agentNameDebounceTimer: null,
      /** 确认优化前必填：源 IP */
      sourceIpInput: '',
      /** 访问关系 / 策略表统一表体高度（px），不足时留白、超出则滚动 */
      tableBodyFixedHeight: 350,
      sourceIp: '',
      sourceType: ''
    }
  },
  computed: {
    subtitleText () {
      return this.assetSummary
        ? `当前资产：${this.assetSummary}`
        : '针对异常暴露的服务进行访问控制与收敛。'
    },
    issuePreviewAlertTitle () {
      const portText = this.issuePreviewPort
        ? String(this.issuePreviewPort)
        : '—'
      return `将下发到 Agent（端口：${portText}），可在此删除不需要的策略后再点击“确认优化”完成下发。`
    }
  },
  created () {
    this.initConvergenceData()
  },
  watch: {
    accessRelations: {
      handler () {
        this.initConvergenceData()
      },
      deep: true
    },
    convergenceContext: {
      handler () {
        this.initConvergenceData()
      },
      deep: true
    }
  },
  methods: {
    /** 生成待下发策略预览数据 */
    buildIssuePreviewRows () {
      // 方法用途：将左侧勾选的访问关系与“all 黑名单（当前端口）”合并为待下发策略列表
      const realDestPortRaw = this.getRealDestPort()
      const realDestPortNum = Number(realDestPortRaw)
      const issuePort = Number.isFinite(realDestPortNum)
        ? realDestPortNum
        : String(realDestPortRaw || '').trim()
      this.issuePreviewPort = issuePort

      const selectedRows = Array.isArray(this.selectedAccessRows)
        ? this.selectedAccessRows
        : []
      const baseRules = selectedRows
        .map(selectedRow => {
          const srcIp = String(
            selectedRow.src_ip ||
              selectedRow.srcIp ||
              selectedRow.source_ip ||
              selectedRow.ip ||
              ''
          ).trim()
          if (!srcIp) return null
          return {
            ip: srcIp,
            port: issuePort,
            protocol: 'tcp',
            // 访问关系勾选下发：白名单
            ruleType: 'Whitelist',
            direction: 'incomming',
            __from: 'access'
          }
        })
        .filter(Boolean)

      // 判断右侧策略列表是否已存在：ip=all & port=当前端口 & ruleType=Blacklist（需同时满足）
      const hasAllBlacklist = Array.isArray(this.hostPolicyRows)
        ? this.hostPolicyRows.some(ruleRow => {
            const ipValue = String(ruleRow.ip || '')
              .trim()
              .toLowerCase()
            const portValue =
              ruleRow.port !== undefined && ruleRow.port !== null
                ? Number(ruleRow.port)
                : Number.NaN
            const ruleTypeValue = String(
              ruleRow.ruleType || ruleRow.rule_type || ''
            ).trim()
            return (
              ipValue === 'all' &&
              Number.isFinite(portValue) &&
              portValue === Number(issuePort) &&
              ruleTypeValue === 'Blacklist'
            )
          })
        : false

      const allBlacklistRule = hasAllBlacklist
        ? []
        : [
            {
              ip: 'all',
              port: issuePort,
              protocol: 'tcp',
              ruleType: 'Blacklist',
              direction: 'incomming',
              __from: 'auto_all_blacklist'
            }
          ]

      const mergedRules = [...baseRules, ...allBlacklistRule]

      // 去重：避免重复下发同一条规则
      const uniqueMap = new Map()
      mergedRules.forEach(ruleItem => {
        const key = [
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
        if (!uniqueMap.has(key)) uniqueMap.set(key, ruleItem)
      })
      this.issuePreviewRows = Array.from(uniqueMap.values())
      return { hasAllBlacklist }
    },

    /** 进入待下发策略预览区 */
    enterIssuePreview () {
      // 方法用途：从访问关系与策略列表切换到待下发策略预览区
      this.buildIssuePreviewRows()
      this.issuePreviewVisible = true
    },

    /** 退出待下发策略预览区 */
    exitIssuePreview () {
      // 方法用途：返回访问关系与策略列表区域，便于重新勾选与调整
      this.issuePreviewVisible = false
    },

    /** 预览区删除一条待下发策略 */
    removeIssuePreviewRow (rowIndex) {
      // 方法用途：在预览区删除用户不希望下发的策略
      if (
        !Array.isArray(this.issuePreviewRows) ||
        !this.issuePreviewRows.length
      )
        return
      const safeIndex = Number(rowIndex)
      if (!Number.isFinite(safeIndex) || safeIndex < 0) return
      this.issuePreviewRows.splice(safeIndex, 1)
    },
    /** 初始化收敛数据（先确认 Agent 安装，再拉列表） */
    initConvergenceData () {
      // 方法用途：收敛面板初始化与上下文变化时统一刷新数据
      this.getAgentIsInstalled()
    },
    /** 查询当前资产是否安装 Agent */
    getAgentIsInstalled () {
      // 方法用途：判断 Agent 安装状态并决定是否加载主机策略列表
      const realDestIp = this.getRealDestIp()
      if (!realDestIp) {
        this.checkingAgentInstalled = false
        this.hasInstalledAgent = false
        this.installedAgentId = ''
        this.hostPolicyRows = []
        this.accessRelationshipList = []
        this.accessRelationshipTotal = 0
        return
      }
      const requestPayload = {
        condition: `ip=${realDestIp}`,
        currentPage: 1,
        pageSize: 99999
      }
      this.checkingAgentInstalled = true
      agentIsInstalled(requestPayload)
        .then(responseData => {
          const installedAgentList =
            responseData &&
            responseData.data &&
            Array.isArray(responseData.data.datas)
              ? responseData.data.datas
              : []
          const firstInstalledAgent =
            installedAgentList.length > 0 ? installedAgentList[0] : null
          const installedAgentId =
            firstInstalledAgent && firstInstalledAgent.id != null
              ? String(firstInstalledAgent.id)
              : ''
          this.installedAgentId = installedAgentId
          this.hasInstalledAgent = !!installedAgentId
          if (this.hasInstalledAgent) {
            this.$emit('agent-installed-change', true)
            this.fetchHostPolicyRows(installedAgentId)
            this.querySrcIpsByDestIpPort()
            this.fetchBypassPolicyRows()
          } else {
            this.$emit('agent-installed-change', false)
            this.hostPolicyRows = []
            this.accessRelationshipList = []
            this.accessRelationshipTotal = 0
            this.selectedAccessRows = []
            this.getAgentGroupList()
          }
        })
        .catch(() => {
          this.hasInstalledAgent = false
          this.installedAgentId = ''
          this.hostPolicyRows = []
          this.accessRelationshipList = []
          this.accessRelationshipTotal = 0
          this.selectedAccessRows = []
          this.$emit('agent-installed-change', false)
          this.$message.error('查询 Agent 安装状态失败')
        })
        .finally(() => {
          this.checkingAgentInstalled = false
        })
    },
    /** 提取目的 IP：直接使用父组件传入的 assetIp */
    getRealDestIp () {
      const contextData = this.convergenceContext || {}
      const assetIp = String(contextData.assetIp || '').trim()
      return assetIp
    },
    /** 提取目的端口：优先当前点击项（含 rawData），其次列表首条，兼容攻击面 affect_port 与 dispose 条目的 port */
    getRealDestPort () {
      const contextData = this.convergenceContext || {}
      const currentItem = contextData.item || {}
      const fromNestedRaw =
        currentItem.rawData && typeof currentItem.rawData === 'object'
          ? currentItem.rawData
          : {}
      const riskItems = Array.isArray(contextData.riskItems)
        ? contextData.riskItems
        : []
      const firstRisk = riskItems.length > 0 ? riskItems[0] : {}
      const firstRiskRaw =
        firstRisk.rawData && typeof firstRisk.rawData === 'object'
          ? firstRisk.rawData
          : firstRisk
      const pickPort = row => {
        if (!row || typeof row !== 'object') return undefined
        const value =
          row.affect_port ||
          row.lan_port ||
          row.dst_port ||
          row.dest_port ||
          row.port
        return value !== undefined && value !== null && value !== ''
          ? value
          : undefined
      }
      const rawPortValue =
        pickPort(fromNestedRaw) ||
        pickPort(currentItem) ||
        pickPort(firstRiskRaw) ||
        pickPort(firstRisk)
      const parsedPort = Number(rawPortValue)
      return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 443
    },
    // 访问关系
    querySrcIpsByDestIpPort () {
      const realDestIp = this.getRealDestIp()
      const realDestPort = this.getRealDestPort()
      querySrcIpsByDestIpPortAPI({
        dest_ip: realDestIp,
        dest_port: realDestPort,
        page: 1,
        page_size: 99999
      })
        .then(responseBody => {
          // 方法用途：兼容 { data: { items, total } } 与扁平结构，避免解构错误导致列表不刷新
          const outer =
            responseBody && typeof responseBody === 'object' ? responseBody : {}
          const inner =
            outer.data != null && typeof outer.data === 'object'
              ? outer.data
              : outer
          const items = Array.isArray(inner.items)
            ? inner.items
            : Array.isArray(inner.src_ips)
            ? inner.src_ips.map(srcIp => ({
                src_ip: srcIp,
                ip: srcIp
              }))
            : []
          const totalRaw = inner.total != null ? inner.total : items.length
          const totalNum = Number(totalRaw)
          this.accessRelationshipList = items
          this.accessRelationshipTotal = Number.isFinite(totalNum)
            ? totalNum
            : items.length
          this.$nextTick(() => {
            const accessRelationTable = this.$refs.accessRelationTableRef
            if (accessRelationTable && accessRelationTable.clearSelection) {
              accessRelationTable.clearSelection()
            }
            this.selectedAccessRows = []
          })
        })
        .catch(() => {
          this.accessRelationshipList = []
          this.accessRelationshipTotal = 0
          this.selectedAccessRows = []
          this.$message.error('访问关系数据加载失败')
        })
    },
    /** 访问关系勾选变更 */
    handleAccessSelectionChange (selectedRows) {
      // 方法用途：记录访问关系勾选数据，用于确认优化时组装 rules
      this.selectedAccessRows = Array.isArray(selectedRows) ? selectedRows : []
    },

    /** 查询旁路策略列表 */
    fetchBypassPolicyRows () {
      const realDestIp = this.getRealDestIp()
      const requestPayload = {
        current_page: 1,
        page_size: 99999,
        condition: `dst_addr=${realDestIp}`
      }
      this.bypassPolicyLoading = true
      queryPolicyList(requestPayload)
        .then(responseData => {
          this.bypassPolicyRows =
            responseData &&
            responseData.data &&
            Array.isArray(responseData.data.rules)
              ? responseData.data.rules
              : []
        })
        .catch(() => {
          this.$message.error('旁路策略列表加载失败')
        })
        .finally(() => {
          this.bypassPolicyLoading = false
        })
    },
    /** 查询主机策略列表 */
    fetchHostPolicyRows (agentId) {
      // 方法用途：使用真实 Agent ID 调用 queryAgentRule 接口刷新主机策略列表
      if (!agentId) {
        this.hostPolicyRows = []
        return
      }

      const realDestPort = this.getRealDestPort()

      const queryParams = {
        cond: `agentId=${agentId}andport=${realDestPort}`
      }
      this.hostPolicyLoading = true
      queryAgentRule(queryParams)
        .then(responseData => {
          const hostRuleList = Array.isArray(responseData)
            ? responseData
            : Array.isArray(responseData && responseData.data)
            ? responseData.data
            : Array.isArray(
                responseData && responseData.data && responseData.data.data
              )
            ? responseData.data.data
            : []
          this.hostPolicyRows = hostRuleList.map(hostRuleItem => {
            const ruleTypeRaw =
              hostRuleItem.ruleType ||
              hostRuleItem.rule_type ||
              hostRuleItem.rule ||
              ''
            const normalizedRuleType = String(ruleTypeRaw).toLowerCase()
            return {
              ...hostRuleItem,
              // 方法用途：统一字段命名，避免模板取值不到导致空白
              port:
                hostRuleItem.port !== undefined && hostRuleItem.port !== null
                  ? hostRuleItem.port
                  : hostRuleItem.dst_port,
              ruleType:
                normalizedRuleType === 'whitelist'
                  ? 'Whitelist'
                  : normalizedRuleType === 'blacklist'
                  ? 'Blacklist'
                  : String(ruleTypeRaw).trim(),
              direction: String(
                hostRuleItem.direction || hostRuleItem.flow_direction || ''
              ).trim()
            }
          })
        })
        .catch(() => {
          this.$message.error('主机策略列表加载失败')
        })
        .finally(() => {
          this.hostPolicyLoading = false
        })
    },
    /** 处理 Agent 名称输入（防抖校验） */
    handleAgentNameInput () {
      // 方法用途：输入名称后防抖校验可用性
      if (this.agentNameDebounceTimer) {
        clearTimeout(this.agentNameDebounceTimer)
      }
      this.agentNameDebounceTimer = setTimeout(() => {
        this.checkAgentName()
      }, 500)
    },
    /** 处理 Agent 名称失焦 */
    handleAgentNameBlur () {
      // 方法用途：名称失焦时立即校验
      if (this.agentNameDebounceTimer) {
        clearTimeout(this.agentNameDebounceTimer)
      }
      this.checkAgentName()
    },
    /** 校验 Agent 名称可用性 */
    checkAgentName () {
      // 方法用途：调用后端校验名称是否可用
      const agentName = String(this.agentInstallForm.name || '').trim()
      if (!agentName) {
        this.agentNameStatus = ''
        this.agentNameHint = ''
        return
      }
      this.agentNameLoading = true
      this.agentNameStatus = ''
      agentNameIsAvailableAPI({ name: agentName })
        .then(({ data }) => {
          if (data === null || data === undefined || Number(data) > 0) {
            this.agentNameStatus = 'error'
            this.agentNameHint = '名称不可用'
          } else {
            this.agentNameStatus = 'success'
            this.agentNameHint = ''
          }
        })
        .catch(() => {
          this.agentNameStatus = 'error'
          this.agentNameHint = '名称校验失败'
        })
        .finally(() => {
          this.agentNameLoading = false
          this.refreshAgentInstallCommand()
        })
    },
    /** 查询 Agent 组列表 */
    getAgentGroupList () {
      // 方法用途：获取 Agent 分组列表用于安装表单选择
      queryAgentGroupList().then(({ data }) => {
        this.agentInstallGroupList = data && data.datas ? data.datas : []
      })
    },
    /** 刷新安装命令 */
    refreshAgentInstallCommand () {
      // 方法用途：按安装表单参数生成实时安装命令
      const packageGroup = String(
        this.agentInstallForm.packageGroup || ''
      ).trim()
      const host = String(this.agentInstallForm.host || '').trim()
      const name = String(this.agentInstallForm.name || '').trim()
      const group = String(this.agentInstallForm.group || '').trim()
      if (!packageGroup || !host || !name || !group) {
        this.agentInstallCommand = ''
        return
      }
      if (this.agentNameLoading || this.agentNameStatus !== 'success') {
        this.agentInstallCommand = ''
        return
      }
      agentInstallAPI({
        os: packageGroup,
        host,
        name,
        group
      }).then(({ data }) => {
        this.agentInstallCommand = data && data.install ? data.install : ''
      })
    },
    /** 新增 Agent 组 */
    createAgentGroup () {
      // 方法用途：弹窗新增 Agent 分组并刷新列表
      this.$prompt('请输入组名（仅支持中文和英文字母）', '创建组', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^[a-zA-Z\u4e00-\u9fa5]+$/,
        inputErrorMessage: '组名只能包含中文或英文字母'
      })
        .then(({ value }) => {
          if (!value || !String(value).trim()) {
            this.$message.error('组名不能为空')
            return
          }
          createAgentGroupAPI({ group_id: value }).then(({ msg }) => {
            this.$message(msg || '创建成功')
            this.getAgentGroupList()
          })
        })
        .catch(() => {})
    },
    /** 复制 Agent 安装命令 */
    copyAgentInstallCommand () {
      // 方法用途：复制安装命令到剪贴板
      const installCommand = String(this.agentInstallCommand || '').trim()
      if (!installCommand) {
        this.$message.warning('暂无可复制的安装命令')
        return
      }
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(installCommand)
          .then(() => this.$message.success('复制成功'))
          .catch(() => this.$message.error('复制失败'))
      } else {
        this.$message.warning('当前浏览器不支持自动复制，请手动复制')
      }
    },

    /** 确认优化前校验 */
    validateBeforeConfirmOptimize () {
      // 方法用途：校验确认优化是否满足 Agent 安装与勾选条件
      if (!this.hasInstalledAgent || !this.installedAgentId) {
        this.$message.warning('请先安装 Agent 后再确认优化')
        return false
      }
      if (
        !Array.isArray(this.selectedAccessRows) ||
        !this.selectedAccessRows.length
      ) {
        this.$message.warning('请先勾选访问关系后再确认优化')
        return false
      }
      return true
    },
    /** 供父级（独立弹框 / 风险详情 footer）提交时取参 */
    getConfirmOptimizePayload () {
      // 方法用途：返回父组件确认优化需要的参数
      return {
        policyType: this.policyType,
        assetIp: this.getRealDestIp(),
        agentId: this.installedAgentId,
        selectedRows: this.selectedAccessRows
      }
    },
    /** 执行主机策略确认优化（batchAgentRule） */
    submitHostConfirmOptimize () {
      // 方法用途：确认优化交互
      // 1）若右侧已存在 all+当前端口+Blacklist，则不进预览，直接下发本次勾选的白名单规则
      // 2）若不存在，则第一次点击进入预览，第二次点击才下发（包含系统默认补齐的 all 黑名单）
      if (!this.validateBeforeConfirmOptimize()) {
        return Promise.reject(new Error('invalid_confirm_optimize'))
      }

      // 未进入预览时：先判断是否可以直接下发（已存在 all 黑名单规则）
      if (!this.issuePreviewVisible) {
        const buildResult = this.buildIssuePreviewRows() || {}
        const hasAllBlacklist = !!buildResult.hasAllBlacklist

        if (hasAllBlacklist) {
          // 直接下发：仅下发本次用户勾选生成的白名单规则
          const directRules = Array.isArray(this.issuePreviewRows)
            ? this.issuePreviewRows.filter(ruleItem => ruleItem.__from === 'access')
            : []
          if (!directRules.length) {
            this.$message.warning('暂无可下发的策略')
            return Promise.reject(new Error('no_rules_to_submit'))
          }
          const requestPayload = {
            ip: this.getRealDestIp(),
            batchAddRuleRequest: {
              agentId: this.installedAgentId,
              rules: directRules.map(ruleItem => ({
                ip: String(ruleItem.ip || '').trim(),
                port: Number(ruleItem.port),
                protocol: 'tcp',
                rule_type: 'Whitelist',
                direction: 'incomming'
              }))
            }
          }
          return batchAgentRule(requestPayload).then(responseData => {
            if (!responseData || responseData.code !== 0) {
              this.$message.error(
                (responseData && responseData.msg) || '确认优化失败'
              )
              throw new Error('batch_agent_rule_failed')
            }
            this.$message.success(responseData.msg || '确认优化成功')
            this.fetchHostPolicyRows(this.installedAgentId)
            return {
              ...this.getConfirmOptimizePayload(),
              requestPayload
            }
          })
        }

        // 需要补齐 all 黑名单：进入预览
        this.issuePreviewVisible = true
        return Promise.resolve({
          ...this.getConfirmOptimizePayload(),
          preview: true,
          previewRows: this.issuePreviewRows
        })
      }

      // 第二次点击（预览可见）：按预览当前内容下发（走原逻辑）
      if (
        !Array.isArray(this.issuePreviewRows) ||
        !this.issuePreviewRows.length
      ) {
        this.$message.warning('暂无可下发的策略')
        return Promise.reject(new Error('no_rules_to_submit'))
      }

      const requestPayload = {
        ip: this.getRealDestIp(),
        batchAddRuleRequest: {
          agentId: this.installedAgentId,
          rules: this.issuePreviewRows.map(ruleItem => ({
            ip: String(ruleItem.ip || '').trim(),
            port: Number(ruleItem.port),
            protocol: String(ruleItem.protocol || 'tcp').trim(),
            rule_type: String(ruleItem.ruleType || 'Blacklist').trim(),
            direction: String(ruleItem.direction || 'incomming').trim()
          }))
        }
      }
      return batchAgentRule(requestPayload).then(responseData => {
        if (!responseData || responseData.code !== 0) {
          this.$message.error(
            (responseData && responseData.msg) || '确认优化失败'
          )
          throw new Error('batch_agent_rule_failed')
        }
        this.$message.success(responseData.msg || '确认优化成功')
        this.exitIssuePreview()
        this.fetchHostPolicyRows(this.installedAgentId)
        return {
          ...this.getConfirmOptimizePayload(),
          requestPayload
        }
      })
    },
    handleSubmit () {
      if (!this.sourceIp) return this.$message.warning('请填写源IP')
      if (!this.sourceType) return this.$message.warning('请选择类型')
      if (this.installedAgentId == '')
        return this.$message.warning('请先部署agent')

      const realDestPort = this.getRealDestPort()
      const rulesContent = [
        {
          ip: this.sourceIp,
          port: Number(realDestPort),
          protocol: 'tcp',
          rule_type: this.sourceType,
          direction: 'incomming'
        }
      ]
      const requestBody = {
        ip: this.nowIp,
        batchAddRuleRequest: {
          agentId: this.installedAgentId,
          rules: rulesContent
        }
      }
      batchAgentRule(requestBody)
        .then(res => {
          if (!res || res.code !== 0) {
            this.$message.error((res && res.msg) || '策略下发失败')
            return
          }
          console.log('下发', res)
          this.$message.success(res.msg)
          this.sourceIp = ''
          this.sourceType = ''
          this.fetchHostPolicyRows(this.installedAgentId)
        })
        .catch(error => {
          console.error('handleSubmit error:', error)
          this.$message.error((error && error.message) || '策略下发失败')
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.service-convergence-panel {
  &--embedded {
    padding-top: 2px;
  }
}

.service-convergence-lead {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.55;
  color: #6b7280;
}

.service-convergence-preview-alert {
  margin-bottom: 12px;
}

.service-convergence-preview-ip-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-convergence-preview-ip-text {
  min-width: 0;
}

.service-convergence-preview-source-tag {
  flex-shrink: 0;
}

.policy-type-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.policy-type-card {
  border-radius: 10px !important;
  border: 2px solid #e5e7eb !important;
  background: #fafafa !important;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;

  &.is-active {
    border-color: #7c3aed !important;
    background: linear-gradient(
      135deg,
      rgba(245, 243, 255, 0.95) 0%,
      #ffffff 100%
    ) !important;
    box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.12);
  }

  &:hover:not(.is-active) {
    border-color: #d1d5db !important;
  }

  :deep(.el-card__body){
    padding: 14px 16px;
  }
}

.policy-type-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.policy-type-icon-wrap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #fff;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: background 0.2s, color 0.2s;

  &.is-active {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
  }
}

.policy-type-card-text {
  flex: 1;
  min-width: 0;
}

.policy-type-title {
  font-size: 14px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 4px;
}

.policy-type-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #6b7280;
}

.policy-type-radio {
  flex-shrink: 0;
  margin-top: 4px;

  :deep(.el-radio__label) {
    display: none;
  }
}

.service-convergence-split {
  margin-left: 0 !important;
  margin-right: 0 !important;

  @media (max-width: 992px) {
    :deep(.el-col) {
      margin-bottom: 14px;
    }
    :deep(.el-col:last-child) {
      margin-bottom: 0;
    }
  }
}

.service-convergence-table-card {
  display: flex;
  flex-direction: column;
  min-height: 332px;
  border-radius: 10px !important;
  border: 1px solid #e5e7eb !important;
  background: #ffffff !important;
  height: 100%;

  :deep(.el-card__header){
    padding: 10px 14px;
    flex-shrink: 0;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
  }

  :deep(.el-card__body){
    padding: 0;
    flex: 1;
    min-height: 0;
  }
}

.service-convergence-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: #111827;

  i {
    color: #7c3aed;
    font-size: 16px;
  }
}

.service-convergence-table {
  :deep(.el-table__header th)  {
    background: #f9fafb;
    color: #4b5563;
    font-weight: 700;
  }

  /* 固定列表头（如预览区源IP fixed=left） */
  :deep(.el-table__fixed-header-wrapper .el-table__header th){
    background: #f9fafb;
    color: #4b5563;
    font-weight: 700;
  }
  :deep(.el-table__fixed-header-wrapper .cell) {
    color: #4b5563;
    font-weight: 700;
  }
  :deep(.el-table__fixed-header-wrapper){
    z-index: 3;
  }

  /* 表格内滚动条更细，避免占用过多视觉宽度 */
  :deep(.el-table__body-wrapper){
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

.service-convergence-port-tag {
  font-weight: 700;
  min-width: 44px;
  text-align: center;
}

.service-convergence-host-action-tag {
  font-weight: 700;
}

.service-convergence-host-direction-tag {
  font-weight: 600;
}

.service-convergence-host-port-text {
  color: #4b5563;
  font-weight: 700;
}

.service-convergence-host-action-text {
  font-weight: 700;
  color: #6b7280;

  &.is-allow {
    color: #67c23a;
  }

  &.is-deny {
    color: #f56c6c;
  }
}

.service-convergence-action-icon--alert {
  color: #acb8c4;
  font-size: 16px;
}

.service-convergence-action-icon--pass {
  color: #67c23a;
  font-size: 14px;
}

.service-convergence-action-icon--reject {
  color: #b22222;
  font-size: 14px;
}

.service-convergence-deliver-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.service-convergence-source-card {
  margin-bottom: 16px;
  border-radius: 10px !important;
  border: 1px solid #ede9fe !important;
  background: linear-gradient(180deg, #fafaff 0%, #ffffff 100%) !important;

  :deep(.el-card__body){
    padding: 14px 16px 16px;
  }
}

.service-convergence-source-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  i {
    color: #7c3aed;
    font-size: 18px;
  }
}

.service-convergence-source-card-title {
  font-size: 13px;
  font-weight: 800;
  color: #111827;
}

.service-convergence-source-hint-icon {
  font-size: 15px !important;
  color: #a78bfa !important;
  cursor: help;
}

.service-convergence-source-form {
  max-width: 420px;

  :deep(.el-form-item){
    margin-bottom: 0;
  }

  :deep(.el-form-item__label){
    color: #4b5563;
    font-weight: 700;
    padding-bottom: 4px;
  }
}

.service-convergence-agent-checking {
  margin-bottom: 4px;
}

.service-convergence-agent-checking-card {
  border-radius: 12px !important;
  border: 1px solid #e5e7eb !important;
  min-height: 200px;

  :deep(.el-card__body)  {
    padding: 0;
  }

  :deep(.el-loading-mask){
    border-radius: 12px;
  }
}

.service-convergence-agent-checking-placeholder {
  min-height: 200px;
}

.service-convergence-agent-empty {
  margin-bottom: 4px;
}

.service-convergence-agent-empty-card {
  border-radius: 10px !important;
  border: 1px solid #fcd34d !important;
  background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%) !important;

  :deep(.el-card__body){
    padding: 18px 18px 16px;
  }
}

.service-convergence-agent-empty-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #92400e;
  margin-bottom: 8px;

  i {
    color: #d97706;
    font-size: 18px;
  }
}

.service-convergence-agent-empty-desc {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}

.service-convergence-agent-form {
  margin-top: 6px;

  :deep(.el-form-item)  {
    margin-bottom: 12px;
  }

  :deep(.el-form-item__label) {
    font-size: 12px;
    color: #4b5563;
    font-weight: 700;
    padding-bottom: 4px;
  }
}

.service-convergence-agent-name-hint {
  margin-top: 4px;
  font-size: 12px;

  &.is-error {
    color: #f56c6c;
  }

  &.is-success {
    color: #67c23a;
  }
}

.service-convergence-agent-group-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.service-convergence-agent-group-select {
  flex: 1;
}

.service-convergence-agent-command-box {
  margin-top: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  overflow: hidden;
}

.service-convergence-agent-command-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #edeff3;
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
}

.service-convergence-agent-command-content {
  padding: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #111827;
  word-break: break-all;
}

@media (max-width: 992px) {
  .policy-type-cards {
    grid-template-columns: 1fr;
  }
}
.form_line {
  display: flex;
  align-items: center;
  margin: 6px 0;
  justify-content: center;
  :deep(.el-input__inner)  {
    height: 30px;
    line-height: 30px;
    font-size: 12px;
  }
  :deep(.el-input__icon)  {
    line-height: 30px !important;
  }
  .label {
    margin-right: 8px;
    font-size: 12px;
  }
}
</style>
