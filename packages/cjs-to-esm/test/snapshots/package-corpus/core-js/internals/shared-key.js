import shared from "../internals/shared";
import uid from "../internals/uid";
var keys = shared('keys');
const _cjs_default = function (key) {
  return keys[key] || (keys[key] = uid(key));
};
export default _cjs_default;
