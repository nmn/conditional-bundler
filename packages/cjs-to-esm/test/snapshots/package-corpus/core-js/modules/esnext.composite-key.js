import $ from "../internals/export";
import apply from "../internals/function-apply";
import getCompositeKeyNode from "../internals/composite-key";
import getBuiltIn from "../internals/get-built-in";
import create from "../internals/object-create";
var $Object = Object;
var initializer = function () {
  var freeze = getBuiltIn('Object', 'freeze');
  return freeze ? freeze(create(null)) : create(null);
};

// https://github.com/tc39/proposal-richer-keys/tree/master/compositeKey
$({
  global: true,
  forced: true
}, {
  compositeKey: function compositeKey() {
    return apply(getCompositeKeyNode, $Object, arguments).get('object', initializer);
  }
});
const _cjs_default = {};
export default _cjs_default;
