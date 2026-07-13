import TYPED_ARRAYS_CONSTRUCTORS_REQUIRES_WRAPPERS from "../internals/typed-array-constructors-require-wrappers";
import { exportTypedArrayStaticMethod as _exportTypedArrayStaticMethod } from "../internals/array-buffer-view-core";
import typedArrayFrom from "../internals/typed-array-from";
var exportTypedArrayStaticMethod = _exportTypedArrayStaticMethod;
// `%TypedArray%.from` method
// https://tc39.es/ecma262/#sec-%typedarray%.from
exportTypedArrayStaticMethod('from', typedArrayFrom, TYPED_ARRAYS_CONSTRUCTORS_REQUIRES_WRAPPERS);
const _cjs_default = {};
export default _cjs_default;
