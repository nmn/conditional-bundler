import $ from "../internals/export";
import isRegisteredSymbol from "../internals/symbol-is-registered";
// `Symbol.isRegistered` method
// obsolete version of https://tc39.es/proposal-symbol-predicates/#sec-symbol-isregisteredsymbol
$({
  target: 'Symbol',
  stat: true,
  name: 'isRegisteredSymbol'
}, {
  isRegistered: isRegisteredSymbol
});
const _cjs_default = {};
export default _cjs_default;
