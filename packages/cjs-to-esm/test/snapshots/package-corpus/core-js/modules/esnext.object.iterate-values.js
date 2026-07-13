import $ from "../internals/export";
import ObjectIterator from "../internals/object-iterator";
// TODO: Remove from `core-js@4`

// `Object.iterateValues` method
// https://github.com/tc39/proposal-object-iteration
$({
  target: 'Object',
  stat: true,
  forced: true
}, {
  iterateValues: function iterateValues(object) {
    return new ObjectIterator(object, 'values');
  }
});
const _cjs_default = {};
export default _cjs_default;
