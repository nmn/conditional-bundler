import $ from "../internals/export";
import anObject from "../internals/an-object";
import createProperty from "../internals/create-property";
import iterate from "../internals/iterate";
import getIteratorDirect from "../internals/get-iterator-direct";
// `Iterator.prototype.toArray` method
// https://tc39.es/ecma262/#sec-iterator.prototype.toarray
$({
  target: 'Iterator',
  proto: true,
  real: true
}, {
  toArray: function toArray() {
    var result = [];
    var index = 0;
    iterate(getIteratorDirect(anObject(this)), function (element) {
      createProperty(result, index++, element);
    }, {
      IS_RECORD: true
    });
    return result;
  }
});
const _cjs_default = {};
export default _cjs_default;
