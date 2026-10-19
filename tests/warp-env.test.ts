/**
 * Environment handed to the agent `pxpipe warp` spawns.
 *
 * Claude Code >= 2.1.281 opens server-side threads to first-party hosts, so
 * follow-up requests carry only a delta and history collapse has nothing to
 * image (#320). Warp turns that off in the child unless the user chose
 * otherwise.
 *
 * Run just this file:  pnpm vitest run tests/warp-env.test.ts
 */
import { describe, expect, it } from 'vitest';
import { warpChildEnv } from '../src/warp/env.js';

const PROXY = 'http://127.0.0.1:50175';
const BUNDLE = '/home/u/.pxpipe/warp-ca-bundle.pem';

describe('warpChildEnv', () => {
  it('disables Claude Code server-side threads by default', () => {
    const env = warpChildEnv({}, PROXY, BUNDLE);
    expect(env.CLAUDE_CODE_TETHER_LIVE).toBe('0');
  });

  it('keeps a value the user already set', () => {
    expect(warpChildEnv({ CLAUDE_CODE_TETHER_LIVE: '1' }, PROXY, BUNDLE).CLAUDE_CODE_TETHER_LIVE).toBe('1');
    expect(warpChildEnv({ CLAUDE_CODE_TETHER_LIVE: '' }, PROXY, BUNDLE).CLAUDE_CODE_TETHER_LIVE).toBe('');
  });

  it('strips base-URL overrides and points proxy and trust at warp', () => {
    const env = warpChildEnv(
      { ANTHROPIC_BASE_URL: 'http://127.0.0.1:47821', ANTHROPIC_UNIX_SOCKET: '/tmp/s', PATH: '/bin' },
      PROXY,
      BUNDLE,
    );
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_UNIX_SOCKET).toBeUndefined();
    expect(env.PATH).toBe('/bin');
    for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy']) expect(env[k]).toBe(PROXY);
    for (const k of ['NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'CURL_CA_BUNDLE', 'REQUESTS_CA_BUNDLE']) {
      expect(env[k]).toBe(BUNDLE);
    }
  });

  it('does not mutate the parent environment', () => {
    const base = { ANTHROPIC_BASE_URL: 'x' };
    warpChildEnv(base, PROXY, BUNDLE);
    expect(base).toEqual({ ANTHROPIC_BASE_URL: 'x' });
  });
});
