import classof from "../../internals/classof";
import hasOwn from "../../internals/has-own-property";
import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/for-each";
import "../../modules/web.dom-collections.for-each";
var ArrayPrototype = Array.prototype;
var DOMIterables = {
  DOMTokenList: true,
  NodeList: true
};
const _cjs_default = function (it) {
  var own = it.forEach;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.forEach || hasOwn(DOMIterables, classof(it)) ? method : own;
};
export default _cjs_default;
