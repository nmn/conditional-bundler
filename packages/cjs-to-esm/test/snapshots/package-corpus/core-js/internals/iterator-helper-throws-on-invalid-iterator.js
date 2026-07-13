// Should throw an error on invalid iterator
// https://issues.chromium.org/issues/336839115
const _cjs_default = function (methodName, argument) {
  // eslint-disable-next-line es/no-iterator -- required for testing
  var method = typeof Iterator == 'function' && Iterator.prototype[methodName];
  if (method) try {
    method.call({
      next: null
    }, argument).next();
  } catch (error) {
    return true;
  }
};
export default _cjs_default;
