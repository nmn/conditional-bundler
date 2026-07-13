import store from "../internals/shared-store";
const _cjs_default = function (key, value) {
  return store[key] || (store[key] = value || {});
};
export default _cjs_default;
