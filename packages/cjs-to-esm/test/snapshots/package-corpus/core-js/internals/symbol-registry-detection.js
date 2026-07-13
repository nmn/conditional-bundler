import NATIVE_SYMBOL from "../internals/symbol-constructor-detection";
/* eslint-disable es/no-symbol -- safe */
const _cjs_default = NATIVE_SYMBOL && !!Symbol['for'] && !!Symbol.keyFor;
export default _cjs_default;
