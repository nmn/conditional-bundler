import uncurryThis from "../internals/function-uncurry-this";
import iterateSimple from "../internals/iterate-simple";
import { Set as _Set, proto as _proto } from "../internals/set-helpers";
var Set = _Set;
var SetPrototype = _proto;
var forEach = uncurryThis(SetPrototype.forEach);
var keys = uncurryThis(SetPrototype.keys);
var next = keys(new Set()).next;
const _cjs_default = function (set, fn, interruptible) {
  return interruptible ? iterateSimple({
    iterator: keys(set),
    next: next
  }, fn) : forEach(set, fn);
};
export default _cjs_default;
