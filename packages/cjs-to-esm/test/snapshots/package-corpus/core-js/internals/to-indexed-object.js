import IndexedObject from "../internals/indexed-object";
import requireObjectCoercible from "../internals/require-object-coercible";
// toObject with fallback for non-array-like ES3 strings

const _cjs_default = function (it) {
  return IndexedObject(requireObjectCoercible(it));
};
export default _cjs_default;
