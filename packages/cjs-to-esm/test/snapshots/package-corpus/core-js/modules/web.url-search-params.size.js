import DESCRIPTORS from "../internals/descriptors";
import uncurryThis from "../internals/function-uncurry-this";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
var URLSearchParamsPrototype = URLSearchParams.prototype;
var forEach = uncurryThis(URLSearchParamsPrototype.forEach);

// `URLSearchParams.prototype.size` getter
// https://github.com/whatwg/url/pull/734
if (DESCRIPTORS && !('size' in URLSearchParamsPrototype)) {
  defineBuiltInAccessor(URLSearchParamsPrototype, 'size', {
    get: function size() {
      var count = 0;
      forEach(this, function () {
        count++;
      });
      return count;
    },
    configurable: true,
    enumerable: true
  });
}
const _cjs_default = {};
export default _cjs_default;
