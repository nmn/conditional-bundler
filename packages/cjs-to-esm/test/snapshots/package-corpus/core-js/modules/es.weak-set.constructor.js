import collection from "../internals/collection";
import collectionWeak from "../internals/collection-weak";
// `WeakSet` constructor
// https://tc39.es/ecma262/#sec-weakset-constructor
collection('WeakSet', function (init) {
  return function WeakSet() {
    return init(this, arguments.length ? arguments[0] : undefined);
  };
}, collectionWeak);
const _cjs_default = {};
export default _cjs_default;
