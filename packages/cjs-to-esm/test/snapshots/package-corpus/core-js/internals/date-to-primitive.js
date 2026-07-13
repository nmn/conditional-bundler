import anObject from "../internals/an-object";
import ordinaryToPrimitive from "../internals/ordinary-to-primitive";
var $TypeError = TypeError;

// `Date.prototype[@@toPrimitive](hint)` method implementation
// https://tc39.es/ecma262/#sec-date.prototype-@@toprimitive
const _cjs_default = function (hint) {
  anObject(this);
  if (hint === 'string' || hint === 'default') hint = 'string';else if (hint !== 'number') throw new $TypeError('Incorrect hint');
  return ordinaryToPrimitive(this, hint);
};
export default _cjs_default;
