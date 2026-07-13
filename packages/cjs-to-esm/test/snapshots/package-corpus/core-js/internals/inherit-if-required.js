import isCallable from "../internals/is-callable";
import isObject from "../internals/is-object";
import setPrototypeOf from "../internals/object-set-prototype-of";
// makes subclassing work correct for wrapped built-ins
const _cjs_default = function ($this, dummy, Wrapper) {
  var NewTarget, NewTargetPrototype;
  if (
  // it can work only with native `setPrototypeOf`
  setPrototypeOf &&
  // we haven't completely correct pre-ES6 way for getting `new.target`, so use this
  isCallable(NewTarget = dummy.constructor) && NewTarget !== Wrapper && isObject(NewTargetPrototype = NewTarget.prototype) && NewTargetPrototype !== Wrapper.prototype) setPrototypeOf($this, NewTargetPrototype);
  return $this;
};
export default _cjs_default;
