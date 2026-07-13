import globalThis from "../internals/global-this";
import userAgent from "../internals/environment-user-agent";
import classof from "../internals/classof-raw";
/* global Bun, Deno -- detection */

var userAgentStartsWith = function (string) {
  return userAgent.slice(0, string.length) === string;
};
const _cjs_default = function () {
  if (userAgentStartsWith('Bun/')) return 'BUN';
  if (userAgentStartsWith('Cloudflare-Workers')) return 'CLOUDFLARE';
  if (userAgentStartsWith('Deno/')) return 'DENO';
  if (userAgentStartsWith('Node.js/')) return 'NODE';
  if (globalThis.Bun && typeof Bun.version == 'string') return 'BUN';
  if (globalThis.Deno && typeof Deno.version == 'object') return 'DENO';
  if (classof(globalThis.process) === 'process') return 'NODE';
  if (globalThis.window && globalThis.document) return 'BROWSER';
  return 'REST';
}();
export default _cjs_default;
