import wellKnownSymbol from "../internals/well-known-symbol";
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var test = {};
// eslint-disable-next-line unicorn/no-immediate-mutation -- ES3 syntax limitation
test[TO_STRING_TAG] = 'z';
const _cjs_default = String(test) === '[object z]';
export default _cjs_default;
