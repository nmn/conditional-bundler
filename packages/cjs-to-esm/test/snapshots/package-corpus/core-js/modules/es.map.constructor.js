import collection from "../internals/collection";
import collectionStrong from "../internals/collection-strong";
// `Map` constructor
// https://tc39.es/ecma262/#sec-map-objects
collection('Map', function (init) {
  return function Map() {
    return init(this, arguments.length ? arguments[0] : undefined);
  };
}, collectionStrong);
const _cjs_default = {};
export default _cjs_default;
