var $TypeError = TypeError;
const _cjs_default = function (passed, required) {
  if (passed < required) throw new $TypeError('Not enough arguments');
  return passed;
};
export default _cjs_default;
