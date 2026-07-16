import isObject from "../internals/is-object";
import _cjs_import from "../internals/internal-state";
var getInternalState = _cjs_import.get;
const _cjs_default = function isRawJSON(O) {
  if (!isObject(O)) return false;
  var state = getInternalState(O);
  return !!state && state.type === 'RawJSON';
};
export default _cjs_default;
