import $ from "../internals/export";
import ObjectIterator from "../internals/object-iterator";
// TODO: Remove from `core-js@4`

// `Object.iterateKeys` method
// https://github.com/tc39/proposal-object-iteration
$({
  target: 'Object',
  stat: true,
  forced: true
}, {
  iterateKeys: function iterateKeys(object) {
    return new ObjectIterator(object, 'keys');
  }
});
const _cjs_default = {};
export default _cjs_default;
