import * as _cjs_import from "node:util";
import Client from "../dispatcher/client";
import { buildMockDispatch as _buildMockDispatch } from "./mock-utils";
import { kDispatches as _kDispatches, kMockAgent as _kMockAgent, kClose as _kClose, kOriginalClose as _kOriginalClose, kOrigin as _kOrigin, kOriginalDispatch as _kOriginalDispatch, kConnected as _kConnected, kIgnoreTrailingSlash as _kIgnoreTrailingSlash } from "./mock-symbols";
import { MockInterceptor as _MockInterceptor } from "./mock-interceptor";
import { kConnected as _kConnected2, kClients as _kClients } from "../core/symbols";
import { InvalidArgumentError as _InvalidArgumentError } from "../core/errors";
const {
  promisify
} = _cjs_import;
/**
 * MockClient provides an API that extends the Client to influence the mockDispatches.
 */
class MockClient extends Client {
  constructor(origin, opts) {
    if (!opts || !opts.agent || typeof opts.agent.dispatch !== 'function') {
      throw new _InvalidArgumentError('Argument opts.agent must implement Agent');
    }
    super(origin, opts);
    this[_kMockAgent] = opts.agent;
    this[_kOrigin] = origin;
    this[_kIgnoreTrailingSlash] = opts.ignoreTrailingSlash ?? false;
    this[_kDispatches] = [];
    this[_kConnected] = 1;
    this[_kOriginalDispatch] = this.dispatch;
    this[_kOriginalClose] = this.close.bind(this);
    this.dispatch = _buildMockDispatch.call(this);
    this.close = this[_kClose];
  }
  get [_kConnected2]() {
    return this[_kConnected];
  }

  /**
   * Sets up the base interceptor for mocking replies from undici.
   */
  intercept(opts) {
    return new _MockInterceptor(opts && {
      ignoreTrailingSlash: this[_kIgnoreTrailingSlash],
      ...opts
    }, this[_kDispatches]);
  }
  cleanMocks() {
    this[_kDispatches] = [];
  }
  async [_kClose]() {
    await promisify(this[_kOriginalClose])();
    this[_kConnected] = 0;
    this[_kMockAgent][_kClients].delete(this[_kOrigin]);
  }
}
const _cjs_default = MockClient;
export default _cjs_default;
