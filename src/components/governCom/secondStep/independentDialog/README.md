# independentDialog

治理第二步的独立弹窗组件目录。

后续用于放置关键漏洞验证、服务收敛等可以脱离外层治理弹窗单独打开的组件，当前先建立目录，暂不接入具体组件。
<!--
  第二步独立弹窗目录说明
  - CriticalVulnVerifyIndependentDialog：关键漏洞验证
  - HighRiskPortVerifyIndependentDialog：高危端口复测
  - ServiceConvergenceIndependentDialog：服务收敛治理
  - EmailNotifyIndependentDialog：邮件通知

  四个弹窗均使用 Vue3 的 v-model，实例通过 ref.open(context) 打开，
  子组件的结果通过 verify-result / success / sent 等事件向外回传。
-->

# secondStep independentDialog

这些弹窗只负责容器和生命周期，具体业务表单分别复用同目录上级的第二步组件。
