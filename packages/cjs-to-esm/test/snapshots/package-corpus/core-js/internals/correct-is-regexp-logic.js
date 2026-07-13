import wellKnownSymbol from "../internals/well-known-symbol";
var MATCH = wellKnownSymbol('match');
const _cjs_default = function (METHOD_NAME) {
  var regexp = /./;
  try {
    '/./'[METHOD_NAME](regexp);
  } catch (error1) {
    try {
      regexp[MATCH] = false;
      return '/./'[METHOD_NAME](regexp);
    } catch (error2) {/* empty */}
  }
  return false;
};
export default _cjs_default;
