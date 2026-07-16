import NativePromiseConstructor from "../internals/promise-native-constructor";
import checkCorrectnessOfIteration from "../internals/check-correctness-of-iteration";
import _cjs_import from "../internals/promise-constructor-detection";
var FORCED_PROMISE_CONSTRUCTOR = _cjs_import.CONSTRUCTOR;
const _cjs_default = FORCED_PROMISE_CONSTRUCTOR || !checkCorrectnessOfIteration(function (iterable) {
  NativePromiseConstructor.all(iterable).then(undefined, function () {/* empty */});
});
export default _cjs_default;
