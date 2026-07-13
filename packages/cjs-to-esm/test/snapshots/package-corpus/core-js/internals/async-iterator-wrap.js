import call from "../internals/function-call";
import createAsyncIteratorProxy from "../internals/async-iterator-create-proxy";
const _cjs_default = createAsyncIteratorProxy(function () {
  return call(this.next, this.iterator);
}, true);
export default _cjs_default;
