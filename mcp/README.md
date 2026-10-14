# LuckMail MCP Server

让 AI Agent（Claude Code、WorkBuddy、Cursor 等）通过 MCP 协议操作 LuckMail 临时邮箱服务。

## 提供的工具

| 工具 | 说明 |
|------|------|
| `create_mailbox` | 创建临时邮箱。不传 `address` 时随机生成；传入时作为本地部分，域名自动拼接。有效期 24 小时 |
| `list_emails` | 获取指定邮箱的邮件列表（元信息，不含正文）。地址传完整邮箱或本地部分均可 |
| `get_email` | 按邮件 id 读取完整内容：发件人、主题、正文（纯文本 + HTML）、附件列表 |

## 配置

通过环境变量配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `LUCKMAIL_BASE_URL` | 否 | LuckMail 服务地址，默认 `https://mail.niubige.top` |
| `LUCKMAIL_API_KEY` | 是 | API 密钥，与 Worker 端的 `LUCKMAIL_API_KEY` 保持一致 |

## 安装与接入

```bash
# 安装依赖（在 mcp/ 目录下）
npm install
```

### WorkBuddy / Claude Desktop（mcp.json）

```json
{
  "mcpServers": {
    "luckmail": {
      "command": "node",
      "args": ["I:/my_project/luckmail/mcp/index.js"],
      "env": {
        "LUCKMAIL_BASE_URL": "https://mail.niubige.top",
        "LUCKMAIL_API_KEY": "<你的访问密钥>"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add luckmail \
  --env LUCKMAIL_BASE_URL=https://mail.niubige.top \
  --env LUCKMAIL_API_KEY=<你的访问密钥> \
  -- node I:/my_project/luckmail/mcp/index.js
```

## 注意事项

- **地址归一化**：服务端数据库中邮箱只存本地部分（`abc`，不含 `@域名`）。MCP 对传入的地址自动取 `@` 前的本地部分，所以传完整地址或本地部分都可以；创建邮箱时同样只提交本地部分。
- **已读即清理**：`get_email` 读取后邮件被服务端标记为已读，定时任务（每小时）会删除已读邮件。需要留档的内容请及时保存。
- **超长截断**：正文字段超过 10000 字符会被截断并标注完整长度，避免撑爆 Agent 上下文。
- **密钥鉴权**：所有请求通过 `Authorization: Bearer <key>` 头传递密钥；Worker 端未配置密钥时所有 API 请求会被拒绝。
