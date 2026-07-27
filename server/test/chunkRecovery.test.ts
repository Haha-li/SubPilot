import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createChunkRecoveryUrl,
  isChunkLoadError,
} from '../../client/src/utils/chunkRecovery';

test('识别部署后常见的动态资源加载失败', () => {
  for (const error of [
    new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/page-old.js'),
    new Error('Importing a module script failed.'),
    new Error('Loading chunk 42 failed'),
    new Error('Unable to preload CSS for /assets/page-old.css'),
    new Error('Couldn\'t resolve component "default" at "/calendar"'),
  ]) {
    assert.equal(isChunkLoadError(error), true);
  }
  assert.equal(isChunkLoadError(new Error('接口返回 500')), false);
});

test('资源恢复地址保留目标路由并追加缓存破坏参数', () => {
  const recovered = new URL(createChunkRecoveryUrl(
    'https://subpilot.example.com/?from=dashboard',
    '/calendar?view=month#today',
    123456,
  ));

  assert.equal(recovered.pathname, '/calendar');
  assert.equal(recovered.searchParams.get('view'), 'month');
  assert.equal(recovered.searchParams.get('__subpilot_reload'), '123456');
  assert.equal(recovered.hash, '#today');
});
