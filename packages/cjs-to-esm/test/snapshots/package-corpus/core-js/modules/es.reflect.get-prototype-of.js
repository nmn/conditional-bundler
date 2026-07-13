import $ from "../internals/export";
import anObject from "../internals/an-object";
import objectGetPrototypeOf from "../internals/object-get-prototype-of";
import CORRECT_PROTOTYPE_GETTER from "../internals/correct-prototype-getter";
// `Reflect.getPrototypeOf` method
// https://tc39.es/ecma262/#sec-reflect.getprototypeof
$({
  target: 'Reflect',
  stat: true,
  sham: !CORRECT_PROTOTYPE_GETTER
}, {
  getPrototypeOf: function getPrototypeOf(target) {
    return objectGetPrototypeOf(anObject(target));
  }
});
const _cjs_default = {};
export default _cjs_default;
