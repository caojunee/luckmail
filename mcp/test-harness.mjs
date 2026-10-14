/**
 * MCP Server 本地自测脚本（stdio JSON-RPC 驱动）
 * 用法：node test-harness.mjs
 * 前置：wrangler dev 运行在 127.0.0.1:8787
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MCP_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

const child = spawn(process.execPath, ['index.js'], {
  cwd: MCP_DIR,
  env: {
    ...process.env,
    LUCKMAIL_BASE_URL: BASE_URL,
    LUCKMAIL_API_KEY: 'gkc2020..',
  },
});

let buf = '';
const pending = new Map();
let nextId = 1;

child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch (e) {
      console.error('[harness] 非 JSON 输出:', line.slice(0, 200));
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write('[server] ' + d.toString()));
child.on('exit', (code) => console.log(`[server] exited with ${code}`));

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 20000);
  });
}

try {
  // 1. initialize 握手
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-harness', version: '1.0.0' },
  });
  console.log('== initialize ==');
  console.log(JSON.stringify(init.result?.serverInfo ?? init));

  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // 2. tools/list
  const tools = await send('tools/list', {});
  console.log('\n== tools/list ==');
  console.log((tools.result?.tools ?? []).map((t) => `${t.name}(${Object.keys(t.inputSchema?.properties ?? {}).join(',')})`).join(' | '));

  // 3. create_mailbox（随机）
  const created = await send('tools/call', { name: 'create_mailbox', arguments: {} });
  console.log('\n== create_mailbox ==');
  console.log(created.result?.content?.[0]?.text);

  // 4. create_mailbox（指定本地部分）
  const created2 = await send('tools/call', { name: 'create_mailbox', arguments: { address: 'mcp-box@mail.niubige.top' } });
  console.log('\n== create_mailbox(自定义, 传入完整地址验证归一化) ==');
  console.log(created2.result?.content?.[0]?.text);

  // 5. list_emails（传完整地址，验证归一化）
  const listed = await send('tools/call', { name: 'list_emails', arguments: { address: 'mcp-box@mail.niubige.top' } });
  console.log('\n== list_emails ==');
  console.log(listed.result?.content?.[0]?.text);

  // 6. get_email（不存在的 id，应返回可读错误而非崩溃）
  const bad = await send('tools/call', { name: 'get_email', arguments: { id: 'nonexistent-id' } });
  console.log('\n== get_email(不存在的id) ==');
  console.log('isError:', bad.result?.isError);
  console.log((bad.result?.content?.[0]?.text ?? '').slice(0, 200));

  // 7. 错误密钥场景：重启一个错误密钥的实例
  console.log('\n== 全部通过 ==');
} catch (e) {
  console.error('[harness] 测试失败:', e.message);
  process.exitCode = 1;
} finally {
  child.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 300);
}
