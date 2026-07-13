import aCallable from "../internals/a-callable";
var $TypeError = TypeError;
var PromiseCapability = function (C) {
  var resolve, reject;
  this.promise = new C(function ($$resolve, $$reject) {
    if (resolve !== undefined || reject !== undefined) throw new $TypeError('Bad Promise constructor');
    resolve = $$resolve;
    reject = $$reject;
  });
  this.resolve = aCallable(resolve);
  this.reject = aCallable(reject);
};

// `NewPromiseCapability` abstract operation
// https://tc39.es/ecma262/#sec-newpromisecapability
const _f = function (C) {
  return new PromiseCapability(C);
};
export { _f as f };
const _cjs_default = {
  ["f"]: _f
};
export default _cjs_default;
