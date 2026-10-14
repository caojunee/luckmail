/**
 * API 密钥的前端存储与请求注入
 *
 * 服务端所有 /api/* 接口都需要 API 密钥。前端流程：
 *   1. 本地没有密钥时渲染 <ApiKeyGate /> 门禁，用户输入密钥
 *   2. 门禁用密钥请求一次 /api/config 验证有效性，通过后存入 localStorage
 *   3. 之后所有请求通过 authFetch 自动附加 Authorization: Bearer <key>
 *   4. 任何请求收到 401 时清除本地密钥并广播 UNAUTHORIZED_EVENT，门禁重新出现
 */

const API_KEY_STORAGE_KEY = 'luckmail_api_key';

// API 地址配置放在这里（而不是 api.ts），供密钥验证使用，
// 避免 auth <-> api 循环依赖；api.ts 会从这里 re-export
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/** 401 时广播的事件名，App 监听后重新渲染密钥门禁 */
export const UNAUTHORIZED_EVENT = 'luckmail:unauthorized';

/** 读取本地保存的 API 密钥 */
export const getApiKey = (): string | null => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
};

/** 保存 API 密钥到 localStorage */
export const setApiKey = (key: string): void => {
  localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
};

/** 清除本地保存的 API 密钥 */
export const clearApiKey = (): void => {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // 忽略存储异常
  }
};

/**
 * 验证候选密钥是否有效（用密钥请求一次 /api/config）。
 * 供密钥门禁在保存密钥前调用——此时密钥尚未入库，不能走 authFetch。
 */
export const verifyApiKey = async (key: string): Promise<{ valid: boolean; error?: 'network' | 'invalid' | 'server' }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config`, {
      headers: {
        Authorization: `Bearer ${key.trim()}`,
      },
    });

    if (response.status === 401) {
      return { valid: false, error: 'invalid' };
    }
    if (!response.ok) {
      return { valid: false, error: 'server' };
    }
    return { valid: true };
  } catch (err) {
    console.error('Error verifying API key:', err);
    return { valid: false, error: 'network' };
  }
};

/**
 * 带密钥的 fetch：自动附加 Authorization 头；
 * 收到 401 时清除本地密钥并广播事件，触发门禁重新锁定。
 */
export const authFetch = async (input: string, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  const key = getApiKey();
  if (key) {
    headers.set('Authorization', `Bearer ${key}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearApiKey();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  return response;
};

/**
 * 为浏览器原生资源加载（附件预览 <img>/<iframe>、下载 <a>）生成带密钥的 URL。
 * 这类请求无法携带自定义头，只能通过 ?key= 查询参数传递（服务端已支持）。
 */
export const withApiKey = (url: string): string => {
  const key = getApiKey();
  if (!key) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(key)}`;
};
