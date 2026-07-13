import $ from "../internals/export";
import { f as _f } from "../internals/new-promise-capability";
import { CONSTRUCTOR as _CONSTRUCTOR } from "../internals/promise-constructor-detection";
var FORCED_PROMISE_CONSTRUCTOR = _CONSTRUCTOR;

// `Promise.reject` method
// https://tc39.es/ecma262/#sec-promise.reject
$({
  target: 'Promise',
  stat: true,
  forced: FORCED_PROMISE_CONSTRUCTOR
}, {
  reject: function reject(r) {
    var capability = _f(this);
    var capabilityReject = capability.reject;
    capabilityReject(r);
    return capability.promise;
  }
});
const _cjs_default = {};
export default _cjs_default;
