import $ from "../internals/export";
import toISOString from "../internals/date-to-iso-string";
// `Date.prototype.toISOString` method
// https://tc39.es/ecma262/#sec-date.prototype.toisostring
// PhantomJS / old WebKit has a broken implementations
$({
  target: 'Date',
  proto: true,
  forced: Date.prototype.toISOString !== toISOString
}, {
  toISOString: toISOString
});
const _cjs_default = {};
export default _cjs_default;
