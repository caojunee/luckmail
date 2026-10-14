/**
 * 唯一的 API 请求出口
 *
 * 全站所有对后端 /api/* 的调用都集中在本文件，统一通过 authFetch 发出：
 *   - 自动附加 Authorization: Bearer <key>（密钥由 utils/auth 管理）
 *   - 收到 401 自动清除本地密钥并广播事件，触发密钥门禁重新锁定
 *
 * 页面组件不要直接调用 fetch/authFetch，一律 import 本文件的函数。
 */

import { authFetch, withApiKey, API_BASE_URL } from './auth';

// API地址配置（re-export，保持原有 import 路径可用）
export { API_BASE_URL };

// API请求基础URL
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

// ---------- 系统配置 ----------

// 获取系统配置（邮箱域名列表）
export const getSystemConfig = async () => {
  try {
    const response = await authFetch(apiUrl('/api/config'));
    if (!response.ok) {
      return { success: false as const, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data.success && data.config) {
      return { success: true as const, config: data.config };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error fetching system config:', error);
    return { success: false as const, error };
  }
};

// ---------- 邮箱 ----------

// 创建随机邮箱
export const createRandomMailbox = async (expiresInHours = 24) => {
  try {
    const response = await authFetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresInHours }),
    });

    if (!response.ok) {
      return { success: false as const, error: 'Failed to create mailbox' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true as const, mailbox: data.mailbox };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    return { success: false as const, error };
  }
};

// 创建自定义邮箱
export const createCustomMailbox = async (address: string, expiresInHours = 24) => {
  try {
    if (!address.trim()) {
      return { success: false as const, error: 'Invalid address' };
    }

    const response = await authFetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address.trim(),
        expiresInHours,
      }),
    });

    // 尝试解析响应内容
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 400) {
        // 使用后端返回的错误信息
        return { success: false as const, error: data.error || 'Address already exists' };
      }
      return { success: false as const, error: data.error || 'Failed to create mailbox' };
    }

    if (data.success) {
      return { success: true as const, mailbox: data.mailbox };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error creating custom mailbox:', error);
    return { success: false as const, error };
  }
};

// 获取邮箱信息
export const getMailbox = async (address: string) => {
  try {
    const response = await authFetch(apiUrl(`/api/mailboxes/${address}`));

    if (response.status === 404) {
      return { success: false as const, error: 'Mailbox not found', notFound: true as const };
    }
    if (!response.ok) {
      return { success: false as const, error: 'Failed to fetch mailbox' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true as const, mailbox: data.mailbox };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error fetching mailbox:', error);
    return { success: false as const, error };
  }
};

// 删除邮箱
export const deleteMailbox = async (address: string) => {
  try {
    const response = await authFetch(apiUrl(`/api/mailboxes/${address}`), {
      method: 'DELETE',
    });

    if (!response.ok) {
      return { success: false as const, error: 'Failed to delete mailbox' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true as const };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error deleting mailbox:', error);
    return { success: false as const, error };
  }
};

// ---------- 邮件 ----------

// 获取邮件列表
export const getEmails = async (address: string) => {
  try {
    // 检查地址是否为空
    if (!address) {
      return { success: false as const, error: 'Address is empty', emails: [] };
    }

    const response = await authFetch(apiUrl(`/api/mailboxes/${address}/emails`));

    // 直接处理404状态码
    if (response.status === 404) {
      return { success: false as const, error: 'Mailbox not found', notFound: true as const, emails: [] };
    }

    if (!response.ok) {
      return { success: false as const, error: `Failed to fetch emails: ${response.status}`, emails: [] };
    }

    const data = await response.json();

    if (data.success) {
      return { success: true as const, emails: data.emails };
    }

    // 检查错误信息是否包含"邮箱不存在"
    if (data.error && (data.error.includes('邮箱不存在') || data.error.includes('Mailbox not found'))) {
      return { success: false as const, error: data.error, notFound: true as const, emails: [] };
    }
    return { success: false as const, error: data.error || 'Unknown error', emails: [] };
  } catch (error) {
    return { success: false as const, error, emails: [] };
  }
};

// 获取邮件详情
export const getEmailDetail = async (emailId: string) => {
  try {
    const response = await authFetch(apiUrl(`/api/emails/${emailId}`));

    if (response.status === 404) {
      return { success: false as const, error: 'Email not found', notFound: true as const };
    }
    if (!response.ok) {
      return { success: false as const, error: 'Failed to fetch email' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true as const, email: data.email };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error fetching email detail:', error);
    return { success: false as const, error };
  }
};

// 获取邮件的附件列表
export const getEmailAttachments = async (emailId: string) => {
  try {
    const response = await authFetch(apiUrl(`/api/emails/${emailId}/attachments`));

    if (response.status === 404) {
      return { success: false as const, error: 'Email not found', notFound: true as const };
    }
    if (!response.ok) {
      return { success: false as const, error: 'Failed to fetch attachments' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true as const, attachments: data.attachments };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return { success: false as const, error };
  }
};

// 删除邮件
export const deleteEmail = async (emailId: string) => {
  try {
    const response = await authFetch(apiUrl(`/api/emails/${emailId}`), {
      method: 'DELETE',
    });

    if (!response.ok) {
      return { success: false as const, error: 'Failed to delete email' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true as const };
    }
    return { success: false as const, error: data.error || 'Unknown error' };
  } catch (error) {
    console.error('Error deleting email:', error);
    return { success: false as const, error };
  }
};

// 附件访问 URL（带密钥查询参数，供 <img>/<iframe>/<a> 等浏览器原生加载使用）
export const buildAttachmentUrl = (attachmentId: string, download = false): string => {
  return withApiKey(`${API_BASE_URL}/api/attachments/${attachmentId}${download ? '?download=true' : ''}`);
};

// ---------- 本地存储 ----------

// 保存邮箱信息到本地存储
export const saveMailboxToLocalStorage = (mailbox: Mailbox) => {
  localStorage.setItem('tempMailbox', JSON.stringify({
    ...mailbox,
    savedAt: Date.now() / 1000
  }));
};

// 从本地存储获取邮箱信息
export const getMailboxFromLocalStorage = (): Mailbox | null => {
  const savedMailbox = localStorage.getItem('tempMailbox');
  if (!savedMailbox) return null;

  try {
    const mailbox = JSON.parse(savedMailbox) as Mailbox & { savedAt: number };
    const now = Date.now() / 1000;

    // 检查邮箱是否过期
    if (mailbox.expiresAt < now) {
      localStorage.removeItem('tempMailbox');
      return null;
    }

    return mailbox;
  } catch (error) {
    localStorage.removeItem('tempMailbox');
    return null;
  }
};

// 从本地存储删除邮箱信息
export const removeMailboxFromLocalStorage = () => {
  localStorage.removeItem('tempMailbox');
};
