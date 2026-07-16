import * as _cjs_import from "node:util";
import Pool from "../dispatcher/pool";
import _cjs_import2 from "./mock-utils";
import _cjs_import3 from "./mock-symbols";
import _cjs_import4 from "./mock-interceptor";
import Symbols from "../core/symbols";
import _cjs_import5 from "../core/errors";
const {
  promisify
} = _cjs_import;
const {
  buildMockDispatch
} = _cjs_import2;
const {
  kDispatches,
  kMockAgent,
  kClose,
  kOriginalClose,
  kOrigin,
  kOriginalDispatch,
  kConnected,
  kIgnoreTrailingSlash
} = _cjs_import3;
const {
  MockInterceptor
} = _cjs_import4;
const {
  InvalidArgumentError
} = _cjs_import5;

/**
 * MockPool provides an API that extends the Pool to influence the mockDispatches.
 */
class MockPool extends Pool {
  constructor(origin, opts) {
    if (!opts || !opts.agent || typeof opts.agent.dispatch !== 'function') {
      throw new InvalidArgumentError('Argument opts.agent must implement Agent');
    }
    super(origin, opts);
    this[kMockAgent] = opts.agent;
    this[kOrigin] = origin;
    this[kIgnoreTrailingSlash] = opts.ignoreTrailingSlash ?? false;
    this[kDispatches] = [];
    this[kConnected] = 1;
    this[kOriginalDispatch] = this.dispatch;
    this[kOriginalClose] = this.close.bind(this);
    this.dispatch = buildMockDispatch.call(this);
    this.close = this[kClose];
  }
  get [Symbols.kConnected]() {
    return this[kConnected];
  }

  /**
   * Sets up the base interceptor for mocking replies from undici.
   */
  intercept(opts) {
    return new MockInterceptor(opts && {
      ignoreTrailingSlash: this[kIgnoreTrailingSlash],
      ...opts
    }, this[kDispatches]);
  }
  cleanMocks() {
    this[kDispatches] = [];
  }
  async [kClose]() {
    await promisify(this[kOriginalClose])();
    this[kConnected] = 0;
    this[kMockAgent][Symbols.kClients].delete(this[kOrigin]);
  }
}
const _cjs_default = MockPool;
export default _cjs_default;
