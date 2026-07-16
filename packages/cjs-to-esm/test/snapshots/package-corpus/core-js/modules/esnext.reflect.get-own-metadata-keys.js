import $ from "../internals/export";
import ReflectMetadataModule from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
// TODO: Remove from `core-js@4`

var ordinaryOwnMetadataKeys = ReflectMetadataModule.keys;
var toMetadataKey = ReflectMetadataModule.toKey;

// `Reflect.getOwnMetadataKeys` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  getOwnMetadataKeys: function getOwnMetadataKeys(target /* , targetKey */) {
    var targetKey = arguments.length < 2 ? undefined : toMetadataKey(arguments[1]);
    return ordinaryOwnMetadataKeys(anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
