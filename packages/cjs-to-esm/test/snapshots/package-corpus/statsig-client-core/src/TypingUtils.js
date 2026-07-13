export function _typeOf(input) {
  return Array.isArray(input) ? 'array' : typeof input;
}
export function _isTypeMatch(a, b) {
  const typeOf = x => Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x;
  return typeOf(a) === typeOf(b);
}
const _cjs_default = {
  ["_isTypeMatch"]: _isTypeMatch,
  ["_typeOf"]: _typeOf
};
export default _cjs_default;
