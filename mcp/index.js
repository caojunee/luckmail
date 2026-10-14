#!/usr/bin/env node
/**
 * LuckMail MCP Server (stdio)
 *
 * 让 AI Agent 通过 MCP 协议操作 LuckMail 临时邮箱服务：
 *   - create_mailbox  创建临时邮箱
 *   - list_emails     获取某个邮箱的邮件列表
 *   - get_email       获取邮件完整内容（正文 + 附件列表）
 *
 * 配置（环境变量）：
 *   LUCKMAIL_BASE_URL  服务地址，默认 https://mail.niubige.top
 *   LUCKMAIL_API_KEY   API 密钥（必填），与 Worker 端 LUCKMAIL_API_KEY 一致
 *
 * 说明：stdio 模式下 stdout 只能输出 MCP 协议消息，日志一律走 stderr。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.LUCKMAIL_BASE_URL || 'https://mail.niubige.top').replace(/\/+$/, '');
const API_KEY = process.env.LUCKMAIL_API_KEY || '';

if (!API_KEY) {
  console.error('[luckmail-mcp] 缺少环境变量 LUCKMAIL_API_KEY，无法鉴权');
  process.exit(1);
}

/**
 * 调用 LuckMail API（自动携带 Bearer 密钥）
 */
async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`无法连接 LuckMail 服务（${BASE_URL}）：${err.message}`);
  }

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // 非 JSON 响应按原始文本处理
  }

  if (!response.ok || !data || data.success === false) {
    const reason = (data && (data.error || data.message)) || `HTTP ${response.status}`;
    throw new Error(`LuckMail API 错误：${reason}`);
  }
  return data;
}

/**
 * 邮箱在服务端只存本地部分（不含 @域名），这里统一归一化并校验
 */
function toLocalPart(address) {
  const local = String(address || '').trim().split('@')[0].trim();
  if (!local || !/^[A-Za-z0-9._-]+$/.test(local)) {
    throw new Error(`无效的邮箱地址：${address}（本地部分只允许字母、数字、点、下划线、连字符）`);
  }
  return local;
}

// 邮箱域名列表（懒加载 + 缓存），用于拼接完整邮箱地址
let cachedDomains = null;
async function getDomains() {
  if (cachedDomains) return cachedDomains;
  try {
    const data = await api('/api/config');
    cachedDomains = (data && data.config && data.config.emailDomains) || [];
  } catch (err) {
    console.error(`[luckmail-mcp] 获取域名配置失败：${err.message}`);
    cachedDomains = [];
  }
  return cachedDomains;
}

function iso(ts) {
  return new Date(ts * 1000).toISOString();
}

// 超长字段截断，避免撑爆 Agent 上下文
const MAX_FIELD_LENGTH = 10000;
function truncate(value, label) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= MAX_FIELD_LENGTH) return s;
  return `${s.slice(0, MAX_FIELD_LENGTH)}\n\n[...${label}过长已截断，完整长度 ${s.length} 字符...]`;
}

function formatFrom(email) {
  return email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
}

const server = new McpServer({ name: 'luckmail', version: '1.0.0' });

// ---------- 工具 1：创建邮箱 ----------
server.tool(
  'create_mailbox',
  '创建一个 LuckMail 临时邮箱。不传 address 时随机生成本地部分；传入 address 时作为邮箱本地部分（域名自动拼接）。邮箱有效期 24 小时。',
  {
    address: z.string().optional().describe('自定义邮箱本地部分，例如 mybox；不传则随机生成'),
  },
  async ({ address }) => {
    const body = {};
    if (address !== undefined && String(address).trim() !== '') {
      body.address = toLocalPart(address);
    }

    const data = await api('/api/mailboxes', { method: 'POST', body });
    const mailbox = data.mailbox;
    const domains = await getDomains();
    const fullAddress = mailbox.address.includes('@')
      ? mailbox.address
      : `${mailbox.address}@${domains[0] || '(服务端未配置邮箱域名)'}`;

    const result = {
      address: mailbox.address,
      fullAddress,
      domains,
      createdAt: iso(mailbox.createdAt),
      expiresAt: iso(mailbox.expiresAt),
      hint: '收到邮件后用 list_emails 查询邮件列表（address 传本地部分或完整地址均可）',
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ---------- 工具 2：获取某个邮箱的邮件列表 ----------
server.tool(
  'list_emails',
  '获取指定 LuckMail 邮箱的邮件列表（只含发件人/主题/时间等元信息，不含正文）。返回的邮件 id 用于 get_email 读取内容。',
  {
    address: z.string().describe('邮箱地址，完整地址（abc@mail.niubige.top）或本地部分（abc）均可'),
  },
  async ({ address }) => {
    const local = toLocalPart(address);
    const data = await api(`/api/mailboxes/${encodeURIComponent(local)}/emails`);

    const emails = (data.emails || []).map((e) => ({
      id: e.id,
      from: formatFrom(e),
      subject: e.subject || '(无主题)',
      receivedAt: iso(e.receivedAt),
      hasAttachments: e.hasAttachments,
      isRead: e.isRead,
    }));

    const result = {
      mailbox: local,
      count: emails.length,
      emails,
      hint: emails.length > 0
        ? '用 get_email 传入邮件 id 读取正文'
        : '暂无邮件；验证码类邮件可能需要等待几十秒，可稍后重新调用本工具',
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ---------- 工具 3：获取邮件内容 ----------
server.tool(
  'get_email',
  '根据邮件 id 读取 LuckMail 邮件的完整内容：发件人、主题、正文（纯文本 + HTML）和附件列表。注意：读取后邮件会被标记为已读，服务端定时任务会自动清理已读邮件。',
  {
    id: z.string().describe('邮件 id，来自 list_emails 的返回'),
  },
  async ({ id }) => {
    const data = await api(`/api/emails/${encodeURIComponent(String(id).trim())}`);
    const e = data.email;
    if (!e) {
      throw new Error('邮件不存在');
    }

    const result = {
      id: e.id,
      from: formatFrom(e),
      to: e.toAddress,
      subject: e.subject || '(无主题)',
      receivedAt: iso(e.receivedAt),
      hasAttachments: e.hasAttachments,
      textContent: truncate(e.textContent, '纯文本正文'),
      htmlContent: truncate(e.htmlContent, 'HTML正文'),
      attachments: [],
      note: '读取后邮件已标记为已读，服务端每小时清理一次已读邮件，请及时保存重要内容',
    };

    if (e.hasAttachments) {
      try {
        const att = await api(`/api/emails/${encodeURIComponent(e.id)}/attachments`);
        result.attachments = (att.attachments || []).map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
        }));
      } catch (err) {
        result.attachments = [{ error: `获取附件列表失败：${err.message}` }];
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ---------- 启动 ----------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[luckmail-mcp] 已启动（stdio），服务地址：${BASE_URL}`);
