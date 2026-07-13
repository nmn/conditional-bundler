import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../function/virtual/bind";
var FunctionPrototype = Function.prototype;
const _cjs_default = function (it) {
  var own = it.bind;
  return it === FunctionPrototype || isPrototypeOf(FunctionPrototype, it) && own === FunctionPrototype.bind ? method : own;
};
export default _cjs_default;
