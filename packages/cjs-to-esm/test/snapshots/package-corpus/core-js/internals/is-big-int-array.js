import classof from "../internals/classof";
const _cjs_default = function (it) {
  var klass = classof(it);
  return klass === 'BigInt64Array' || klass === 'BigUint64Array';
};
export default _cjs_default;
