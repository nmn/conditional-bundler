import $ from "../internals/export";
import iterate from "../internals/iterate";
import createProperty from "../internals/create-property";
// `Object.fromEntries` method
// https://tc39.es/ecma262/#sec-object.fromentries
$({
  target: 'Object',
  stat: true
}, {
  fromEntries: function fromEntries(iterable) {
    var obj = {};
    iterate(iterable, function (k, v) {
      createProperty(obj, k, v);
    }, {
      AS_ENTRIES: true
    });
    return obj;
  }
});
const _cjs_default = {};
export default _cjs_default;
