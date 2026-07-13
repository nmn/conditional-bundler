import fails from "../internals/fails";
// Detect IE8's incomplete defineProperty implementation
const _cjs_default = !fails(function () {
  // eslint-disable-next-line es/no-object-defineproperty -- required for testing
  return Object.defineProperty({}, 1, {
    get: function () {
      return 7;
    }
  })[1] !== 7;
});
export default _cjs_default;
