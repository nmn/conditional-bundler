import $ from "../internals/export";
import call from "../internals/function-call";
// `URL.prototype.toJSON` method
// https://url.spec.whatwg.org/#dom-url-tojson
$({
  target: 'URL',
  proto: true,
  enumerable: true
}, {
  toJSON: function toJSON() {
    return call(URL.prototype.toString, this);
  }
});
const _cjs_default = {};
export default _cjs_default;
