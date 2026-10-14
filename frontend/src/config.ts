// 配置文件，用于管理域名和API地址设置

import { getSystemConfig } from './utils/api';

// 邮箱域名配置 - 从 API 动态获取
let cachedEmailDomains: string[] | null = null;
let configLoaded = false;

// 从 API 获取邮箱域名配置
export async function getEmailDomains(): Promise<string[]> {
  if (cachedEmailDomains && configLoaded) {
    return cachedEmailDomains;
  }

  try {
    const result = await getSystemConfig();
    if (result.success && result.config.emailDomains) {
      cachedEmailDomains = result.config.emailDomains;
      configLoaded = true;
      return cachedEmailDomains!;
    }
  } catch (error) {
    console.error('获取邮箱域名配置失败:', error);
  }

  // 如果 API 获取失败，使用环境变量作为后备
  const fallbackDomains = (import.meta.env.VITE_EMAIL_DOMAIN || '').split(',').map(domain => domain.trim()).filter(domain => domain);
  cachedEmailDomains = fallbackDomains.length > 0 ? fallbackDomains : ['example.com'];
  configLoaded = true;
  return cachedEmailDomains!;
}

// 获取默认邮箱域名
export async function getDefaultEmailDomain(): Promise<string> {
  const domains = await getEmailDomains();
  return domains[0] || 'example.com';
}

// 同步版本的邮箱域名配置（用于向后兼容）
export const EMAIL_DOMAINS = (import.meta.env.VITE_EMAIL_DOMAIN || '').split(',').map(domain => domain.trim()).filter(domain => domain) || ['example.com'];
export const DEFAULT_EMAIL_DOMAIN = EMAIL_DOMAINS[0] || 'example.com';

// 其他配置
export const DEFAULT_AUTO_REFRESH = false;
export const AUTO_REFRESH_INTERVAL = 10000; // 10秒
