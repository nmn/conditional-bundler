import $ from "../internals/export";
import globalThis from "../internals/global-this";
import microtask from "../internals/microtask";
import aCallable from "../internals/a-callable";
import validateArgumentsLength from "../internals/validate-arguments-length";
import fails from "../internals/fails";
import DESCRIPTORS from "../internals/descriptors";
// Bun ~ 1.0.30 bug
// https://github.com/oven-sh/bun/issues/9249
var WRONG_ARITY = fails(function () {
  // getOwnPropertyDescriptor for prevent experimental warning in Node 11
  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  return DESCRIPTORS && Object.getOwnPropertyDescriptor(globalThis, 'queueMicrotask').value.length !== 1;
});

// `queueMicrotask` method
// https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-queuemicrotask
$({
  global: true,
  enumerable: true,
  dontCallGetSet: true,
  forced: WRONG_ARITY
}, {
  queueMicrotask: function queueMicrotask(fn) {
    validateArgumentsLength(arguments.length, 1);
    microtask(aCallable(fn));
  }
});
const _cjs_default = {};
export default _cjs_default;
