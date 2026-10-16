import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bash = process.env.BASH_PATH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const shellPath = p => process.platform === 'win32'
  ? p.replaceAll('\\', '/').replace(/^([a-z]):/i, (_, drive) => '/' + drive.toLowerCase())
  : p;

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clouddrop-deploy-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const app = path.join(dir, 'app');
  const bin = path.join(dir, 'bin');
  const state = path.join(dir, 'mock-state');
  const log = path.join(dir, 'commands.log');
  for (const p of [app, bin, state]) fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(app, '.env'), 'PRESERVE_HOST_SECRETS=yes\n');
  fs.writeFileSync(path.join(state, 'backend'), 'ghcr.io/omoniyiifeabraham/clouddrop-backend:previous-backend');
  fs.writeFileSync(path.join(state, 'frontend'), 'ghcr.io/omoniyiifeabraham/clouddrop-frontend:previous-frontend');
  const command = (name, source) => fs.writeFileSync(path.join(bin, name), '#!/usr/bin/env bash\nset -eu\n' + source, { mode: 0o755 });
  command('docker', `
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$1" in
  pull) [ "\u0024{MOCK_PULL_FAIL:-0}" != 1 ] ;;
  inspect)
    container="\u0024{!#}"
    service="\u0024{container#clouddrop-}"
    case "$*" in
      *Config.Image*) cat "$MOCK_STATE/$service" ;;
      *Health*)
        if [ "\u0024{MOCK_UNHEALTHY:-}" = "$service" ]; then echo unhealthy; else echo healthy; fi ;;
      *State.Status*) echo running ;;
      *) exit 1 ;;
    esac ;;
  compose)
    shift 3
    case "$1" in
      run) [ "\u0024{MOCK_NGINX_FAIL:-0}" != 1 ] ;;
      up)
        for arg in "$@"; do
          case "$arg" in
            backend) printf '%s' "$BACKEND_IMAGE" > "$MOCK_STATE/backend" ;;
            frontend) printf '%s' "$FRONTEND_IMAGE" > "$MOCK_STATE/frontend" ;;
          esac
        done ;;
      restart|logs) : ;;
      *) exit 1 ;;
    esac ;;
  *) exit 1 ;;
esac
`);
  command('curl', 'echo "${MOCK_HTTP_STATUS:-200}"\n');
  // Lock invocation/failure is tested; the fake does not claim to test OS locking.
  command('flock', '[ "${MOCK_LOCK_FAIL:-0}" != 1 ]\n');
  command('sleep', ':\n');
  return {
    app, state,
    run(component, backend = '', frontend = '', number = '1', extra = {}) {
      return spawnSync(bash, ['-c', 'export PATH="$MOCK_BIN:$PATH"; exec bash "$@"', '--',
        shellPath(path.join(root, 'scripts/deploy-release.sh')), component, backend, frontend, number], {
        encoding: 'utf8', timeout: 20_000,
        env: { ...process.env, CLOUDDROP_APP_DIR: shellPath(app), MOCK_BIN: shellPath(bin), MOCK_STATE: shellPath(state), MOCK_LOG: shellPath(log), ...extra },
      });
    },
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '',
    image: component => fs.readFileSync(path.join(state, component), 'utf8'),
    marker: component => path.join(app, '.deployment-state', component + '.run'),
  };
}
function passed(result) { assert.equal(result.status, 0, result.stdout + result.stderr + (result.error || '')); }

test('frontend release replaces only frontend and syncs runtime files without touching .env', t => {
  const f = fixture(t);
  passed(f.run('frontend', '', 'frontend-sha', '10'));
  assert.equal(f.image('backend'), 'ghcr.io/omoniyiifeabraham/clouddrop-backend:previous-backend');
  assert.match(f.image('frontend'), /:frontend-sha$/);
  assert.match(f.calls(), /up -d --no-deps frontend/);
  assert.doesNotMatch(f.calls(), /pull .*backend|up -d --no-deps backend/);
  assert.equal(fs.readFileSync(path.join(f.app, '.env'), 'utf8'), 'PRESERVE_HOST_SECRETS=yes\n');
  assert.equal(fs.readFileSync(path.join(f.app, 'nginx/default.conf'), 'utf8'), fs.readFileSync(path.join(root, 'nginx/default.conf'), 'utf8'));
  assert.equal(fs.readFileSync(f.marker('frontend'), 'utf8').trim(), '10');
});

test('backend release preserves the deployed frontend instead of using latest', t => {
  const f = fixture(t);
  passed(f.run('backend', 'backend-sha', '', '20'));
  assert.match(f.image('backend'), /:backend-sha$/);
  assert.equal(f.image('frontend'), 'ghcr.io/omoniyiifeabraham/clouddrop-frontend:previous-frontend');
  assert.match(f.calls(), /up -d --no-deps backend/);
  assert.doesNotMatch(f.calls(), /pull .*frontend|up -d --no-deps frontend/);
});

test('manual deployment can bootstrap a complete image pair', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.state, 'backend'));
  fs.unlinkSync(path.join(f.state, 'frontend'));
  passed(f.run('all', 'backend-v1', 'frontend-v2', '0'));
  assert.match(f.image('backend'), /:backend-v1$/);
  assert.match(f.image('frontend'), /:frontend-v2$/);
  assert.match(f.calls(), /up -d backend frontend nginx/);
});

test('failed image pull never replaces a service or records success', t => {
  const f = fixture(t);
  assert.notEqual(f.run('frontend', '', 'bad-pull', '2', { MOCK_PULL_FAIL: '1' }).status, 0);
  assert.doesNotMatch(f.calls(), /compose .*up /);
  assert.equal(fs.existsSync(f.marker('frontend')), false);
});

test('failed public verification is a failed release and can be retried', t => {
  const f = fixture(t);
  assert.notEqual(f.run('backend', 'new-backend', '', '4', { MOCK_HTTP_STATUS: '503' }).status, 0);
  assert.equal(fs.existsSync(f.marker('backend')), false);
  passed(f.run('backend', 'new-backend', '', '4'));
});

test('missing counterpart image fails explicitly rather than silently deploying latest', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.state, 'backend'));
  assert.notEqual(f.run('frontend', '', 'new-frontend').status, 0);
  assert.doesNotMatch(f.calls(), /pull /);
});

test('an older completed build cannot roll its component back', t => {
  const f = fixture(t);
  passed(f.run('frontend', '', 'newer', '30'));
  const before = f.calls();
  const result = f.run('frontend', '', 'older', '29');
  passed(result);
  assert.match(result.stdout, /Skipping superseded/);
  assert.equal(f.calls(), before);
  assert.match(f.image('frontend'), /:newer$/);
});

test('component run numbers are independent and neither release loses the other image', t => {
  const f = fixture(t);
  passed(f.run('frontend', '', 'new-frontend', '100'));
  passed(f.run('backend', 'new-backend', '', '2'));
  assert.match(f.image('frontend'), /:new-frontend$/);
  assert.match(f.image('backend'), /:new-backend$/);
});

test('invalid image tags fail before Docker or host config changes', t => {
  const f = fixture(t);
  assert.notEqual(f.run('frontend', '', 'bad;command').status, 0);
  assert.equal(f.calls(), '');
});

test('failure to acquire the host lock stops the release', t => {
  const f = fixture(t);
  assert.notEqual(f.run('frontend', '', 'new', '1', { MOCK_LOCK_FAIL: '1' }).status, 0);
  assert.equal(f.calls(), '');
});

test('unhealthy service and invalid Nginx config never record a successful release', t => {
  const f = fixture(t);
  assert.notEqual(f.run('backend', 'new', '', '4', { MOCK_UNHEALTHY: 'backend' }).status, 0);
  assert.equal(fs.existsSync(f.marker('backend')), false);
  assert.notEqual(f.run('backend', 'new', '', '4', { MOCK_NGINX_FAIL: '1' }).status, 0);
  assert.equal(fs.existsSync(f.marker('backend')), false);
});
