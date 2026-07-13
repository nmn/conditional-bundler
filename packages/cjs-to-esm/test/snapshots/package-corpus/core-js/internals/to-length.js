import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
var min = Math.min;

// `ToLength` abstract operation
// https://tc39.es/ecma262/#sec-tolength
const _cjs_default = function (argument) {
  var len = toIntegerOrInfinity(argument);
  return len > 0 ? min(len, 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
};
export default _cjs_default;
