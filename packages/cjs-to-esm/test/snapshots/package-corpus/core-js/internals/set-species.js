import getBuiltIn from "../internals/get-built-in";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import wellKnownSymbol from "../internals/well-known-symbol";
import DESCRIPTORS from "../internals/descriptors";
var SPECIES = wellKnownSymbol('species');
const _cjs_default = function (CONSTRUCTOR_NAME) {
  var Constructor = getBuiltIn(CONSTRUCTOR_NAME);
  if (DESCRIPTORS && Constructor && !Constructor[SPECIES]) {
    defineBuiltInAccessor(Constructor, SPECIES, {
      configurable: true,
      get: function () {
        return this;
      }
    });
  }
};
export default _cjs_default;
