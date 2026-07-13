import toPrimitive from "../internals/to-primitive";
var $TypeError = TypeError;

// `ToBigInt` abstract operation
// https://tc39.es/ecma262/#sec-tobigint
const _cjs_default = function (argument) {
  var prim = toPrimitive(argument, 'number');
  if (typeof prim == 'number') throw new $TypeError("Can't convert number to bigint");
  // eslint-disable-next-line es/no-bigint -- safe
  return BigInt(prim);
};
export default _cjs_default;
