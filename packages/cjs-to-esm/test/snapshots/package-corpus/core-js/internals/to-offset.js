import toPositiveInteger from "../internals/to-positive-integer";
var $RangeError = RangeError;
const _cjs_default = function (it, BYTES) {
  var offset = toPositiveInteger(it);
  if (offset % BYTES) throw new $RangeError('Wrong offset');
  return offset;
};
export default _cjs_default;
