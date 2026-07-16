import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import ReflectMetadataModule from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
import getPrototypeOf from "../internals/object-get-prototype-of";
import $arrayUniqueBy from "../internals/array-unique-by";
// TODO: Remove from `core-js@4`

var arrayUniqueBy = uncurryThis($arrayUniqueBy);
var concat = uncurryThis([].concat);
var ordinaryOwnMetadataKeys = ReflectMetadataModule.keys;
var toMetadataKey = ReflectMetadataModule.toKey;
var ordinaryMetadataKeys = function (O, P) {
  var oKeys = ordinaryOwnMetadataKeys(O, P);
  var parent = getPrototypeOf(O);
  if (parent === null) return oKeys;
  var pKeys = ordinaryMetadataKeys(parent, P);
  return pKeys.length ? oKeys.length ? arrayUniqueBy(concat(oKeys, pKeys)) : pKeys : oKeys;
};

// `Reflect.getMetadataKeys` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  getMetadataKeys: function getMetadataKeys(target /* , targetKey */) {
    var targetKey = arguments.length < 2 ? undefined : toMetadataKey(arguments[1]);
    return ordinaryMetadataKeys(anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
