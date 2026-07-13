import $ from "../internals/export";
import isWellKnownSymbol from "../internals/symbol-is-well-known";
// `Symbol.isWellKnownSymbol` method
// https://tc39.es/proposal-symbol-predicates/#sec-symbol-iswellknownsymbol
// We should patch it for newly added well-known symbols. If it's not required, this module just will not be injected
$({
  target: 'Symbol',
  stat: true,
  forced: true
}, {
  isWellKnownSymbol: isWellKnownSymbol
});
const _cjs_default = {};
export default _cjs_default;
