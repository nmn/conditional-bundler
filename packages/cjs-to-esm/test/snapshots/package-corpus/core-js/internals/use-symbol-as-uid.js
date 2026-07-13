import NATIVE_SYMBOL from "../internals/symbol-constructor-detection";
/* eslint-disable es/no-symbol -- required for testing */

const _cjs_default = NATIVE_SYMBOL && !Symbol.sham && typeof Symbol.iterator == 'symbol';
export default _cjs_default;
