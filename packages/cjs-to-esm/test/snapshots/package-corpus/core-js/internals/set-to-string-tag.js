import { f as _f } from "../internals/object-define-property";
import hasOwn from "../internals/has-own-property";
import wellKnownSymbol from "../internals/well-known-symbol";
var defineProperty = _f;
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
const _cjs_default = function (target, TAG, STATIC) {
  if (target && !STATIC) target = target.prototype;
  if (target && !hasOwn(target, TO_STRING_TAG)) {
    defineProperty(target, TO_STRING_TAG, {
      configurable: true,
      value: TAG
    });
  }
};
export default _cjs_default;
