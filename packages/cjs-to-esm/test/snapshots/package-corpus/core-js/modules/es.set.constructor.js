import collection from "../internals/collection";
import collectionStrong from "../internals/collection-strong";
// `Set` constructor
// https://tc39.es/ecma262/#sec-set-objects
collection('Set', function (init) {
  return function Set() {
    return init(this, arguments.length ? arguments[0] : undefined);
  };
}, collectionStrong);
const _cjs_default = {};
export default _cjs_default;
