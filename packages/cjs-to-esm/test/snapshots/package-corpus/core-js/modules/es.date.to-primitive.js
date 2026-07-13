import hasOwn from "../internals/has-own-property";
import defineBuiltIn from "../internals/define-built-in";
import dateToPrimitive from "../internals/date-to-primitive";
import wellKnownSymbol from "../internals/well-known-symbol";
var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');
var DatePrototype = Date.prototype;

// `Date.prototype[@@toPrimitive]` method
// https://tc39.es/ecma262/#sec-date.prototype-@@toprimitive
if (!hasOwn(DatePrototype, TO_PRIMITIVE)) {
  defineBuiltIn(DatePrototype, TO_PRIMITIVE, dateToPrimitive);
}
const _cjs_default = {};
export default _cjs_default;
