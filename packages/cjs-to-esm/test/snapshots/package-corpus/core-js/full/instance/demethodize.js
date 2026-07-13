import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../function/virtual/demethodize";
var FunctionPrototype = Function.prototype;
const _cjs_default = function (it) {
  var own = it.demethodize;
  return it === FunctionPrototype || isPrototypeOf(FunctionPrototype, it) && own === FunctionPrototype.demethodize ? method : own;
};
export default _cjs_default;
