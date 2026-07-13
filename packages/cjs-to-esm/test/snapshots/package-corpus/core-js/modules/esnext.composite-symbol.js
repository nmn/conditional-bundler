import $ from "../internals/export";
import getCompositeKeyNode from "../internals/composite-key";
import getBuiltIn from "../internals/get-built-in";
import apply from "../internals/function-apply";
// https://github.com/tc39/proposal-richer-keys/tree/master/compositeKey
$({
  global: true,
  forced: true
}, {
  compositeSymbol: function compositeSymbol() {
    if (arguments.length === 1 && typeof arguments[0] == 'string') return getBuiltIn('Symbol')['for'](arguments[0]);
    return apply(getCompositeKeyNode, null, arguments).get('symbol', getBuiltIn('Symbol'));
  }
});
const _cjs_default = {};
export default _cjs_default;
