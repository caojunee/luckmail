# <div align="center">🚀 LuckMail - 24小时临时邮箱服务</div>

<div align="center">

  <img src="frontend/public/favicon.svg" alt="LuckMail Logo" width="120" height="120" style="background-color: #4f46e5; padding: 20px; border-radius: 12px; margin: 20px 0;">

  <h3>💌 安全、简单、即用即走的临时邮箱服务</h3>

  <p>
    <a href="#功能特点"><strong>✨ 功能特点</strong></a> •
    <a href="#快速部署"><strong>🚀 快速部署</strong></a> •
    <a href="#-访问密钥api-鉴权"><strong>🔑 访问密钥</strong></a> •
    <a href="#-本地开发"><strong>💻 本地开发</strong></a> •
    <a href="#-技术栈"><strong>🔧 技术栈</strong></a>
  </p>

</div>

---

## ✨ 功能特点

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
  <div>
    <h4>✨ 即时创建</h4>
    <p>无需注册，立即获得一个临时邮箱地址</p>
  </div>
  <div>
    <h4>🔒 隐私保护</h4>
    <p>访问密钥门禁保护整站，避免被滥用</p>
  </div>
  <div>
    <h4>⚡ 高速接收</h4>
    <p>实时接收邮件，无需刷新页面</p>
  </div>
  <div>
    <h4>🤖 MCP 支持</h4>
    <p>内置 MCP Server，AI Agent 可直接创建邮箱、读取邮件</p>
  </div>
  <div>
    <h4>🔄 自动刷新</h4>
    <p>自动检查新邮件，确保不错过任何重要信息</p>
  </div>
  <div>
    <h4>📱 响应式设计</h4>
    <p>完美适配各种设备，从手机到桌面</p>
  </div>
</div>

---

## 🚀 快速部署

项目采用一体化部署方式：前端和后端整合为一个 Cloudflare Worker，前端构建产物与 Worker API 一同发布。

### 📋 部署步骤

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>克隆本仓库到本地</li>
    <li>在 Cloudflare Dashboard 中创建一个 D1 数据库，记住数据库的 <code>name</code> 和 <code>id</code></li>
    <li>修改根目录下的 <code>wrangler.toml</code> 文件：
      <ul>
        <li>修改 <code>name</code> 为您的应用名称。（可选）</li>
        <li>修改 <code>routes</code> 中的自定义域名。（必须！默认的 worker.dev 域名在中国大陆无法访问）</li>
        <li>修改 <code>database_name</code> 和 <code>database_id</code> 为您的 D1 数据库信息。（必须！）</li>
        <li>修改 <code>VITE_EMAIL_DOMAIN</code> 为您的域名列表，多个域名用逗号分割。（可选，只是方便网页上复制粘贴邮件地址，不设置也不影响接收邮件）</li>
      </ul>
    </li>
    <li>在 Cloudflare Dashboard → Worker → 设置 → 运行时变量和密钥 中添加密钥 <code>LUCKMAIL_API_KEY</code>（详见 <a href="#-访问密钥api-鉴权">访问密钥</a>）</li>
    <li>执行 <code>pnpm install && pnpm run deploy</code> 完成部署</li>
    <li>配置 Cloudflare Email 路由，将邮件转发到您的 Worker</li>
  </ol>
</div>

### 📧 配置邮件路由

无论哪种部署方式，都需要配置 Cloudflare Email 路由：

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>在 Cloudflare 控制面板中找到您的域名</li>
    <li>进入 "Email" -> "Email Routing"</li>
    <li>启用 Email Routing</li>
    <li>添加路由规则：
      <ul>
        <li>匹配类型："Catch-all address"</li>
        <li>操作："Send to a Worker"</li>
        <li>选择您部署的 Worker</li>
      </ul>
    </li>
    <li>如果有多个域名，请为每个域名重复上述步骤</li>
  </ol>
</div>

---

## 🔑 访问密钥（API 鉴权）

本项目所有 `/api/*` 接口均受访问密钥保护，未携带有效密钥的请求会被拒绝（401）。

### 密钥配置方式

| 环境 | 配置位置 |
|------|----------|
| 生产环境 | Cloudflare Dashboard → Worker → 设置 → 运行时变量和密钥 → 添加变量，类型选 **密钥**，名称 `LUCKMAIL_API_KEY` |
| 本地开发 | 项目根目录 `.dev.vars` 文件：`LUCKMAIL_API_KEY=你的密钥`（已被 .gitignore 忽略，不会提交） |

### 密钥携带方式（三选一）

```
Authorization: Bearer <key>     # 推荐（前端 / MCP / 脚本）
X-API-Key: <key>                # 备用请求头
?key=<key>                      # 查询参数，仅供 <img>/<iframe>/<a> 等浏览器原生资源加载
```

### 前端行为

网页首次打开会出现密钥门禁，输入正确密钥后解锁（密钥只保存在本机 localStorage，不会上传）；
任何请求返回 401 时自动回到门禁重新输入。右上角 🔒 按钮可手动锁定并清除本机密钥。

### 🤖 MCP Server

提供 `mcp/` 目录下的 MCP Server，让 AI Agent 使用密钥操作临时邮箱（创建邮箱 / 获取邮件列表 / 读取邮件内容），
详见 [mcp/README.md](./mcp/README.md)。

---

## 💻 本地开发

### 🚀 开发

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">

```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
pnpm dev:frontend

# 启动后端开发服务器
pnpm dev:backend
```

</div>

### ⚙️ 部署

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">

```bash
# 部署
pnpm run deploy
```

</div>

---

## 🔧 技术栈

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">
  <div>
    <h3>🎨 前端</h3>
    <ul>
      <li><strong>React</strong> - 用户界面库</li>
      <li><strong>TypeScript</strong> - 类型安全的JavaScript超集</li>
      <li><strong>Tailwind CSS</strong> - 实用优先的CSS框架</li>
      <li><strong>Vite</strong> - 现代前端构建工具</li>
    </ul>
  </div>
  <div>
    <h3>⚙️ 后端</h3>
    <ul>
      <li><strong>Cloudflare Workers</strong> - 边缘计算平台</li>
      <li><strong>Cloudflare D1</strong> - 边缘SQL数据库</li>
      <li><strong>Cloudflare Email Workers</strong> - 邮件处理服务</li>
      <li><strong>MCP SDK</strong> - AI Agent 接入（Node.js）</li>
    </ul>
  </div>
</div>

---

## 📄 许可证

[MIT License](./LICENSE)
