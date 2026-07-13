import $ from "../internals/export";
import globalThis from "../internals/global-this";
import setToStringTag from "../internals/set-to-string-tag";
$({
  global: true
}, {
  Reflect: {}
});

// Reflect[@@toStringTag] property
// https://tc39.es/ecma262/#sec-reflect-@@tostringtag
setToStringTag(globalThis.Reflect, 'Reflect', true);
const _cjs_default = {};
export default _cjs_default;
