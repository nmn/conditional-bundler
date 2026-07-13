import $ from "../internals/export";
import isRegisteredSymbol from "../internals/symbol-is-registered";
// `Symbol.isRegisteredSymbol` method
// https://tc39.es/proposal-symbol-predicates/#sec-symbol-isregisteredsymbol
$({
  target: 'Symbol',
  stat: true
}, {
  isRegisteredSymbol: isRegisteredSymbol
});
const _cjs_default = {};
export default _cjs_default;
