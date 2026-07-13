import DESCRIPTORS from "../internals/descriptors";
import fails from "../internals/fails";
import createElement from "../internals/document-create-element";
// Thanks to IE8 for its funny defineProperty
const _cjs_default = !DESCRIPTORS && !fails(function () {
  // eslint-disable-next-line es/no-object-defineproperty -- required for testing
  return Object.defineProperty(createElement('div'), 'a', {
    get: function () {
      return 7;
    }
  }).a !== 7;
});
export default _cjs_default;
