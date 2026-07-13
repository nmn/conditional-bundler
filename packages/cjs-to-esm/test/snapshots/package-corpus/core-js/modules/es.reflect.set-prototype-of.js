import $ from "../internals/export";
import anObject from "../internals/an-object";
import aPossiblePrototype from "../internals/a-possible-prototype";
import objectSetPrototypeOf from "../internals/object-set-prototype-of";
// `Reflect.setPrototypeOf` method
// https://tc39.es/ecma262/#sec-reflect.setprototypeof
if (objectSetPrototypeOf) $({
  target: 'Reflect',
  stat: true
}, {
  setPrototypeOf: function setPrototypeOf(target, proto) {
    anObject(target);
    aPossiblePrototype(proto);
    try {
      objectSetPrototypeOf(target, proto);
      return true;
    } catch (error) {
      return false;
    }
  }
});
const _cjs_default = {};
export default _cjs_default;
