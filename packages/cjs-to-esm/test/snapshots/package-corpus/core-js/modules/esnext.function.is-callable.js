import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import $isCallable from "../internals/is-callable";
import inspectSource from "../internals/inspect-source";
import hasOwn from "../internals/has-own-property";
import DESCRIPTORS from "../internals/descriptors";
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var classRegExp = /^\s*class\b/;
var exec = uncurryThis(classRegExp.exec);
var isClassConstructor = function (argument) {
  try {
    // `Function#toString` throws on some built-it function in some legacy engines
    // (for example, `DOMQuad` and similar in FF41-)
    if (!DESCRIPTORS || !exec(classRegExp, inspectSource(argument))) return false;
  } catch (error) {/* empty */}
  var prototype = getOwnPropertyDescriptor(argument, 'prototype');
  return !!prototype && hasOwn(prototype, 'writable') && !prototype.writable;
};

// `Function.isCallable` method
// https://github.com/caitp/TC39-Proposals/blob/trunk/tc39-reflect-isconstructor-iscallable.md
$({
  target: 'Function',
  stat: true,
  sham: true,
  forced: true
}, {
  isCallable: function isCallable(argument) {
    return $isCallable(argument) && !isClassConstructor(argument);
  }
});
const _cjs_default = {};
export default _cjs_default;
