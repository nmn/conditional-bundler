import NativePromiseConstructor from "../internals/promise-native-constructor";
import checkCorrectnessOfIteration from "../internals/check-correctness-of-iteration";
import { CONSTRUCTOR as _CONSTRUCTOR } from "../internals/promise-constructor-detection";
var FORCED_PROMISE_CONSTRUCTOR = _CONSTRUCTOR;
const _cjs_default = FORCED_PROMISE_CONSTRUCTOR || !checkCorrectnessOfIteration(function (iterable) {
  NativePromiseConstructor.all(iterable).then(undefined, function () {/* empty */});
});
export default _cjs_default;
