var $TypeError = TypeError;
const _cjs_default = function (options) {
  var mode = options && options.mode;
  if (mode === undefined || mode === 'shortest' || mode === 'longest' || mode === 'strict') return mode || 'shortest';
  throw new $TypeError('Incorrect `mode` option');
};
export default _cjs_default;
