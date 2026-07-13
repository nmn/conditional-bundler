import bind from "../internals/function-bind-context";
import anObject from "../internals/an-object";
import toObject from "../internals/to-object";
import iterate from "../internals/iterate";
// https://tc39.github.io/proposal-setmap-offrom/

const _cjs_default = function (C, adder, ENTRY) {
  return function from(source /* , mapFn, thisArg */) {
    var O = toObject(source);
    var length = arguments.length;
    var mapFn = length > 1 ? arguments[1] : undefined;
    var mapping = mapFn !== undefined;
    var boundFunction = mapping ? bind(mapFn, length > 2 ? arguments[2] : undefined) : undefined;
    var result = new C();
    var n = 0;
    iterate(O, function (nextItem) {
      var entry = mapping ? boundFunction(nextItem, n++) : nextItem;
      if (ENTRY) adder(result, anObject(entry)[0], entry[1]);else adder(result, entry);
    });
    return result;
  };
};
export default _cjs_default;
