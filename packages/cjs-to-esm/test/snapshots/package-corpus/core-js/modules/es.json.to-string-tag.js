import globalThis from "../internals/global-this";
import setToStringTag from "../internals/set-to-string-tag";
// JSON[@@toStringTag] property
// https://tc39.es/ecma262/#sec-json-@@tostringtag
setToStringTag(globalThis.JSON, 'JSON', true);
const _cjs_default = {};
export default _cjs_default;
