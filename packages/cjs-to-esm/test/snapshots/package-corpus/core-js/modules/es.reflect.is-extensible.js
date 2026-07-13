import $ from "../internals/export";
import anObject from "../internals/an-object";
import $isExtensible from "../internals/object-is-extensible";
// `Reflect.isExtensible` method
// https://tc39.es/ecma262/#sec-reflect.isextensible
$({
  target: 'Reflect',
  stat: true
}, {
  isExtensible: function isExtensible(target) {
    anObject(target);
    return $isExtensible(target);
  }
});
const _cjs_default = {};
export default _cjs_default;
