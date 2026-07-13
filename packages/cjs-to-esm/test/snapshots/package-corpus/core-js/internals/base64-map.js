var commonAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
var base64Alphabet = commonAlphabet + '+/';
var base64UrlAlphabet = commonAlphabet + '-_';
var inverse = function (characters) {
  // TODO: use `Object.create(null)` in `core-js@4`
  var result = {};
  var index = 0;
  for (; index < 64; index++) result[characters.charAt(index)] = index;
  return result;
};
const _cjs_default = {
  i2c: base64Alphabet,
  c2i: inverse(base64Alphabet),
  i2cUrl: base64UrlAlphabet,
  c2iUrl: inverse(base64UrlAlphabet)
};
const _i2c = _cjs_default["i2c"];
export { _i2c as i2c };
const _c2i = _cjs_default["c2i"];
export { _c2i as c2i };
const _i2cUrl = _cjs_default["i2cUrl"];
export { _i2cUrl as i2cUrl };
const _c2iUrl = _cjs_default["c2iUrl"];
export { _c2iUrl as c2iUrl };
export default _cjs_default;
