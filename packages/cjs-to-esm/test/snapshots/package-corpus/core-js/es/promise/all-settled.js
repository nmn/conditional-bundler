import "../../modules/es.array.iterator";
import "../../modules/es.object.to-string";
import "../../modules/es.promise";
import "../../modules/es.promise.all-settled";
import "../../modules/es.string.iterator";
import call from "../../internals/function-call";
import isCallable from "../../internals/is-callable";
import path from "../../internals/path";
var Promise = path.Promise;
var $allSettled = Promise.allSettled;
const _cjs_default = function allSettled(iterable) {
  return call($allSettled, isCallable(this) ? this : Promise, iterable);
};
export default _cjs_default;
