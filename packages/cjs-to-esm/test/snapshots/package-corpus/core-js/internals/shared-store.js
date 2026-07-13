import IS_PURE from "../internals/is-pure";
import globalThis from "../internals/global-this";
import defineGlobalProperty from "../internals/define-global-property";
var SHARED = '__core-js_shared__';
const _cjs_default = globalThis[SHARED] || defineGlobalProperty(SHARED, {});
(store.versions || (store.versions = [])).push({
  version: '3.49.0',
  mode: IS_PURE ? 'pure' : 'global',
  copyright: '© 2013–2025 Denis Pushkarev (zloirock.ru), 2025–2026 CoreJS Company (core-js.io). All rights reserved.',
  license: 'https://github.com/zloirock/core-js/blob/v3.49.0/LICENSE',
  source: 'https://github.com/zloirock/core-js'
});
export default _cjs_default;
