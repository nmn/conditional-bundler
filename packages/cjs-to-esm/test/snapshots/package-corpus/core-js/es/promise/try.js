import "../../modules/es.object.to-string";
import "../../modules/es.promise";
import "../../modules/es.promise.try";
import apply from "../../internals/function-apply";
import isCallable from "../../internals/is-callable";
import path from "../../internals/path";
var Promise = path.Promise;
var $try = Promise['try'];

// eslint-disable-next-line no-unused-vars -- required for arity
const _cjs_default = {
  'try': function (callbackfn /* , ...args */) {
    return apply($try, isCallable(this) ? this : Promise, arguments);
  }
}['try'];
export default _cjs_default;
