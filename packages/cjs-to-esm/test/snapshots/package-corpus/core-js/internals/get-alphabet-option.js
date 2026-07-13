var $TypeError = TypeError;
const _cjs_default = function (options) {
  var alphabet = options && options.alphabet;
  if (alphabet === undefined || alphabet === 'base64' || alphabet === 'base64url') return alphabet || 'base64';
  throw new $TypeError('Incorrect `alphabet` option');
};
export default _cjs_default;
