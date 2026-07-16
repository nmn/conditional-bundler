import isCallable from "../internals/is-callable";
import isObject from "../internals/is-object";
import definePropertyModule from "../internals/object-define-property";
import isPrototypeOf from "../internals/object-is-prototype-of";
import wellKnownSymbol from "../internals/well-known-symbol";
import makeBuiltIn from "../internals/make-built-in";
var HAS_INSTANCE = wellKnownSymbol('hasInstance');
var FunctionPrototype = Function.prototype;

// `Function.prototype[@@hasInstance]` method
// https://tc39.es/ecma262/#sec-function.prototype-@@hasinstance
if (!(HAS_INSTANCE in FunctionPrototype)) {
  definePropertyModule.f(FunctionPrototype, HAS_INSTANCE, {
    value: makeBuiltIn(function (O) {
      if (!isCallable(this) || !isObject(O)) return false;
      var P = this.prototype;
      return isObject(P) ? isPrototypeOf(P, O) : O instanceof this;
    }, HAS_INSTANCE)
  });
}
const _cjs_default = {};
export default _cjs_default;
