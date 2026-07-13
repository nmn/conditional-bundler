import toObject from "../internals/to-object";
import toAbsoluteIndex from "../internals/to-absolute-index";
import lengthOfArrayLike from "../internals/length-of-array-like";
// `Array.prototype.fill` method implementation
// https://tc39.es/ecma262/#sec-array.prototype.fill
const _cjs_default = function fill(value /* , start = 0, end = @length */) {
  var O = toObject(this);
  var length = lengthOfArrayLike(O);
  var argumentsLength = arguments.length;
  var index = toAbsoluteIndex(argumentsLength > 1 ? arguments[1] : undefined, length);
  var end = argumentsLength > 2 ? arguments[2] : undefined;
  var endPos = end === undefined ? length : toAbsoluteIndex(end, length);
  while (endPos > index) O[index++] = value;
  return O;
};
export default _cjs_default;
