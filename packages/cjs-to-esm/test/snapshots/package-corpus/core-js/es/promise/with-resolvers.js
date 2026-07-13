import "../../modules/es.promise";
import "../../modules/es.promise.with-resolvers";
import call from "../../internals/function-call";
import isCallable from "../../internals/is-callable";
import path from "../../internals/path";
var Promise = path.Promise;
var promiseWithResolvers = Promise.withResolvers;
const _cjs_default = function withResolvers() {
  return call(promiseWithResolvers, isCallable(this) ? this : Promise);
};
export default _cjs_default;
