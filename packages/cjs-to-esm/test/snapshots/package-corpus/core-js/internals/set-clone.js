import { Set as _Set, add as _add } from "../internals/set-helpers";
import iterate from "../internals/set-iterate";
var Set = _Set;
var add = _add;
const _cjs_default = function (set) {
  var result = new Set();
  iterate(set, function (it) {
    add(result, it);
  });
  return result;
};
export default _cjs_default;
