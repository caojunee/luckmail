/**
 * API 密钥鉴权模块
 *
 * 所有 /api/* 接口都需要携带有效的 API 密钥（服务端通过环境变量
 * LUCKMAIL_API_KEY 配置）。支持三种携带方式：
 *
 *   1. Authorization: Bearer <key>   （推荐，MCP / 脚本 / 前端 fetch）
 *   2. X-API-Key: <key>              （备用头）
 *   3. ?key=<key> 或 ?api_key=<key>  （查询参数，仅供浏览器原生资源加载使用，
 *                                      如附件预览的 <img>/<iframe>、下载的 <a>
 *                                      标签无法携带自定义请求头）
 */

import { Env } from './types';

/**
 * 从请求中提取 API 密钥，找不到返回 null
 */
export function extractApiKey(request: Request): string | null {
  // 1. Authorization: Bearer <key>
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  // 2. X-API-Key: <key>
  const xApiKey = request.headers.get('X-API-Key');
  if (xApiKey && xApiKey.trim()) {
    return xApiKey.trim();
  }

  // 3. 查询参数 ?key= / ?api_key=
  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('key') || url.searchParams.get('api_key');
    if (queryKey && queryKey.trim()) {
      return queryKey.trim();
    }
  } catch {
    // URL 解析失败时忽略
  }

  return null;
}

/**
 * 恒定时间字符串比较，避免时序侧信道泄露密钥内容
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * 校验请求是否携带有效的 API 密钥
 *
 * fail-closed：服务端未配置 LUCKMAIL_API_KEY 时拒绝所有请求，
 * 避免因漏配密钥导致接口意外裸奔。
 */
export function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.LUCKMAIL_API_KEY;
  if (!expected) {
    return false;
  }

  const provided = extractApiKey(request);
  if (!provided) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
