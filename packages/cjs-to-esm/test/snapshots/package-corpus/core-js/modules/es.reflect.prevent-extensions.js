import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import anObject from "../internals/an-object";
import FREEZING from "../internals/freezing";
// `Reflect.preventExtensions` method
// https://tc39.es/ecma262/#sec-reflect.preventextensions
$({
  target: 'Reflect',
  stat: true,
  sham: !FREEZING
}, {
  preventExtensions: function preventExtensions(target) {
    anObject(target);
    try {
      var objectPreventExtensions = getBuiltIn('Object', 'preventExtensions');
      if (objectPreventExtensions) objectPreventExtensions(target);
      return true;
    } catch (error) {
      return false;
    }
  }
});
const _cjs_default = {};
export default _cjs_default;
