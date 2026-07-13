import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import isCallable from "../internals/is-callable";
import anObject from "../internals/an-object";
var $TypeError = TypeError;

// `Map.prototype.upsert` method
// https://github.com/tc39/proposal-upsert
const _cjs_default = function upsert(key, updateFn /* , insertFn */) {
  var map = anObject(this);
  var get = aCallable(map.get);
  var has = aCallable(map.has);
  var set = aCallable(map.set);
  var insertFn = arguments.length > 2 ? arguments[2] : undefined;
  var value;
  if (!isCallable(updateFn) && !isCallable(insertFn)) {
    throw new $TypeError('At least one callback required');
  }
  if (call(has, map, key)) {
    value = call(get, map, key);
    if (isCallable(updateFn)) {
      value = updateFn(value);
      call(set, map, key, value);
    }
  } else if (isCallable(insertFn)) {
    value = insertFn();
    call(set, map, key, value);
  }
  return value;
};
export default _cjs_default;
