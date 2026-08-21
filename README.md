# CLINI X TRIALS · 科研数据管理平台（RDMS）

面向医院内网部署的临床研究数据管理系统原型。覆盖三端角色：

- **后台管理端**：课题/模块库/CRF 设计器、客户管理、账号授权、数据留痕（不接触患者数据）
- **管理人员端（课题主持人）**：项目/进度/患者/访视/数据集成（HIS 抓取）/数据管理/数据审核/疑问管理/统计分析/账户管理
- **数据录入端（研究人员）**：受试者登记、数据录入（语音录入/文件识别）、访视管理、疑问管理、我的工作台

## 技术栈

React 19 + TypeScript + Vite 7 + Tailwind CSS 3 + shadcn/ui（Radix）+ Recharts + react-router 7

## 新电脑环境准备

1. 安装 **Node.js ≥ 20**（开发时用的是 v24；LTS 即可）和 **Git**
2. 克隆仓库并安装依赖：

```bash
git clone https://github.com/aike-sherry/clinix-trials-rdms.git
cd clinix-trials-rdms
npm install        # 或 npm ci（按 package-lock.json 严格安装）
```

3. 启动开发服务器：

```bash
npm run dev        # 默认 http://localhost:5173
```

4. 构建验证：

```bash
npm run build      # tsc -b && vite build，必须通过
```

> 演示数据在浏览器 localStorage 中自动播种（首次打开登录页约 5–10 秒），换电脑后无需迁移任何数据文件。

## 测试账号（密码均为 123456）

| 角色 | 账号 |
|------|------|
| 后台管理员 | admin@xiaoyi.cn |
| 管理人员（课题主持人） | zhangci@hospital.cn |
| 数据录入人员 | wangfang@hospital.cn / liuyang@hospital.cn / chenjing@hospital.cn |

## 部署说明

应用使用 HashRouter，刷新与直达链接均不会 404，任意静态托管**零配置**可用。

**Vercel（当前测试环境）**：Vercel 导入本仓库即可，框架预设 Vite，构建命令 `npm run build`，输出目录 `dist`，无需任何额外配置；同事测试指引见 `测试指引.md`。

**医院内网（正式定位）**：`npm run build` 产出 `dist/` 纯静态文件，放到任意静态服务器（Nginx/IIS）即可。数据集成（HIS/EMR 抓取）页面为前置演示界面，实际抓取需医院信息科开放视图/接口权限后对接。
