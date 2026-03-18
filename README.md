# electron-vue-app
风险治理平台

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
pnpm install

# 开发模式
pnpm dev

# 生产构建
pnpm build

# 创建安装包
pnpm package

📦 项目结构
text

插入

复制
electron-vue-app/
├── electron/            # 主进程代码
│   ├── main/            # 窗口/托盘/通知管理
│   └── preload/         # 安全桥接脚本
├── src/                 # 渲染进程
│   ├── assets/          # 静态资源
│   ├── stores/          # Pinia 状态管理
│   └── views/           # 业务页面
└── build/               # 打包配置
⚙️ 配置说明
通过 设置 界面可调整：

服务器地址（支持自签名证书）
通知开关（支持声音独立控制）
开机自启动
数据存储路径
📌 设计亮点
高性能通知系统：
独立 BrowserWindow 实现无卡顿弹窗
智能防抖避免消息轰炸
多端体验优化：
Windows 托盘气泡通知
macOS Dock 徽章计数
Linux 系统托盘标准
企业级特性：
单实例锁（防止重复启动）
离线操作队列
自动化测试告警
