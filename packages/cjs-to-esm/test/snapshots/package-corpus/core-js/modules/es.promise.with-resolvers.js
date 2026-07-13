import $ from "../internals/export";
import { f as _f } from "../internals/new-promise-capability";
// `Promise.withResolvers` method
// https://tc39.es/ecma262/#sec-promise.withResolvers
$({
  target: 'Promise',
  stat: true
}, {
  withResolvers: function withResolvers() {
    var promiseCapability = _f(this);
    return {
      promise: promiseCapability.promise,
      resolve: promiseCapability.resolve,
      reject: promiseCapability.reject
    };
  }
});
const _cjs_default = {};
export default _cjs_default;
