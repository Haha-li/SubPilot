import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const ANDROID_MODE = 'android';
const BUILD_TIMEOUT_MS = 300_000;
const clientDirectory = fileURLToPath(new URL('../', import.meta.url));

function fail(message) {
  console.error(`[android] ${message}`);
  process.exit(1);
}

const fileEnvironment = loadEnv(ANDROID_MODE, clientDirectory, '');
let apiUrlValue = process.env.VITE_API_URL;
if (!apiUrlValue?.trim()) apiUrlValue = fileEnvironment.VITE_API_URL;
if (!apiUrlValue?.trim()) {
  fail('缺少 VITE_API_URL；请复制 .env.android.example 为 .env.android.local 并填写 Workers API 地址');
}

const trimmedApiUrl = apiUrlValue.trim();
let apiUrl;
try {
  apiUrl = new URL(trimmedApiUrl);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  fail(`VITE_API_URL 不是有效 URL：${detail}`);
}

if (apiUrl.protocol !== 'https:') fail('VITE_API_URL 必须使用 HTTPS');
if (apiUrl.hostname.endsWith('.invalid')) fail('请将示例 VITE_API_URL 替换为实际 Workers 地址');
if (apiUrl.username || apiUrl.password) fail('VITE_API_URL 不能包含用户名或密码');
if (apiUrl.search || apiUrl.hash) fail('VITE_API_URL 不能包含查询参数或锚点');
const apiPath = apiUrl.pathname.replace(/\/+$/, '');
if (apiPath !== '/api') fail('VITE_API_URL 必须以 /api 结尾');

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) fail('无法定位当前 npm CLI');
const build = spawnSync(process.execPath, [npmCliPath, 'run', 'build', '--', '--mode', ANDROID_MODE], {
  cwd: clientDirectory,
  env: { ...process.env, VITE_API_URL: trimmedApiUrl },
  stdio: 'inherit',
  timeout: BUILD_TIMEOUT_MS,
});

if (build.error) fail(`前端构建启动失败：${build.error.message}`);
if (build.status === null) fail('前端构建未返回退出状态');
process.exit(build.status);
