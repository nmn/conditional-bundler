import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../function/virtual/un-this";
var FunctionPrototype = Function.prototype;
const _cjs_default = function (it) {
  var own = it.unThis;
  return it === FunctionPrototype || isPrototypeOf(FunctionPrototype, it) && own === FunctionPrototype.unThis ? method : own;
};
export default _cjs_default;
