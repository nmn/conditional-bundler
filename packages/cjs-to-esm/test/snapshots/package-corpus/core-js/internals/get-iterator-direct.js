// `GetIteratorDirect(obj)` abstract operation
// https://tc39.es/ecma262/#sec-getiteratordirect
const _cjs_default = function (obj) {
  return {
    iterator: obj,
    next: obj.next,
    done: false
  };
};
export default _cjs_default;
