/**
 * Environment for the agent `pxpipe warp` spawns.
 *
 * Kept apart from index.ts so it can be tested without binding a port or
 * touching ~/.pxpipe.
 */

export function warpChildEnv(
  base: NodeJS.ProcessEnv,
  proxyUrl: string,
  caBundlePath: string,
): NodeJS.ProcessEnv {
  const env = { ...base };
  // The agent must believe it is talking to api.anthropic.com. Both of these
  // would defeat that, and either may be left over in the user's shell from a
  // previous non-warp session.
  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_UNIX_SOCKET;
  env.HTTP_PROXY = proxyUrl;
  env.http_proxy = proxyUrl;
  env.HTTPS_PROXY = proxyUrl;
  env.https_proxy = proxyUrl;
  // Trust is scoped to this child; nothing is added to the system keychain.
  // Which variable actually works depends on the agent's runtime, and the
  // answer is not stable: the macOS `claude` is a native Mach-O binary, not a
  // Node script, so the Node-only variable alone would silently fail to make
  // it trust us. Set every convention — they are inert for runtimes that
  // ignore them, and one of them is the one that counts.
  // NODE_EXTRA_CA_CERTS appends to Node's built-in roots, so the CA-only
  // file is right there. The other three REPLACE the trust store: handing
  // them a 1-cert file strips the public roots from every other HTTPS client
  // in the session (gcloud, gws, pip all fail verification — #245). They get
  // the bundle: our CA followed by the system roots.
  env.NODE_EXTRA_CA_CERTS = caBundlePath; // Node, and Bun-compiled binaries
  env.SSL_CERT_FILE = caBundlePath; // OpenSSL: curl, Rust, Go with cgo
  env.CURL_CA_BUNDLE = caBundlePath; // libcurl
  env.REQUESTS_CA_BUNDLE = caBundlePath; // Python requests / httpx
  // Claude Code >= 2.1.281 talks to api.anthropic.com over server-side
  // threads: after the first turn each request carries only the new delta
  // and the server holds the history (#320). With nothing old in the
  // request, history collapse has nothing to image, so most opus traffic
  // under warp passes through as text. A base-URL session gets stateless
  // full requests because Claude Code only opens threads to first-party
  // hosts — which is exactly what warp makes it believe it is talking to.
  // This switch turns threads off in the client, so the client itself sends
  // full requests; pxpipe still rewrites nothing beyond what it always does.
  // A value the user already set wins, so CLAUDE_CODE_TETHER_LIVE=1 opts back in.
  if (env.CLAUDE_CODE_TETHER_LIVE === undefined) {
    env.CLAUDE_CODE_TETHER_LIVE = '0';
  }
  return env;
}
