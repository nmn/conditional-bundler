import isPrototypeOf from "../internals/object-is-prototype-of";
var $TypeError = TypeError;
const _cjs_default = function (it, Prototype) {
  if (isPrototypeOf(Prototype, it)) return it;
  throw new $TypeError('Incorrect invocation');
};
export default _cjs_default;
