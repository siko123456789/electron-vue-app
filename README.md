# electron-vue-app
风险监控与治理桌面应用

![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron)
![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?logo=vuedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)

企业级风险监控与治理桌面应用，提供实时告警、数据可视化及处置工作流。

## ✨ 核心功能
- **实时风险监测**：系统托盘悬浮窗展示最新风险事件
- **多级告警通知**：
  - 桌面弹窗（支持声音提示🔊）
  - 托盘气泡通知
  - 未读消息计数徽章
- **智能工作流**：风险处置任务分配与追踪
- **离线模式**：断网时自动缓存操作，网络恢复后同步
- **应用锁**：用户可锁定应用，锁定后将只显示解锁界面，不再展示业务内容。密码仅保存在当前设备本地。
- **多平台支持**：Windows/macOS/Linux 跨平台运行

## 🛠️ 技术栈
- **前端框架**：Vue 3 + Pinia + Element Plus
- **桌面运行时**：Electron + Vite
- **核心工具链**：
  - `electron-window-state` - 窗口状态记忆
  - `electron-log` - 跨平台日志
  - `electron-builder` - 打包部署
- **安全特性**：
  - CSP 内容安全策略
  - 证书链验证
  - 敏感数据加密存储

## 🚀 快速开始
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 创建安装包
npm run package
