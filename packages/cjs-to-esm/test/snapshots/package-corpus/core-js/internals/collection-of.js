import anObject from "../internals/an-object";
// https://tc39.github.io/proposal-setmap-offrom/
const _cjs_default = function (C, adder, ENTRY) {
  return function of() {
    var result = new C();
    var length = arguments.length;
    for (var index = 0; index < length; index++) {
      var entry = arguments[index];
      if (ENTRY) adder(result, anObject(entry)[0], entry[1]);else adder(result, entry);
    }
    return result;
  };
};
export default _cjs_default;
