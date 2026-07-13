import "../../modules/es.aggregate-error";
import "../../modules/es.array.iterator";
import "../../modules/es.object.to-string";
import "../../modules/es.promise";
import "../../modules/es.promise.any";
import "../../modules/es.string.iterator";
import call from "../../internals/function-call";
import isCallable from "../../internals/is-callable";
import path from "../../internals/path";
var Promise = path.Promise;
var $any = Promise.any;
const _cjs_default = function any(iterable) {
  return call($any, isCallable(this) ? this : Promise, iterable);
};
export default _cjs_default;
