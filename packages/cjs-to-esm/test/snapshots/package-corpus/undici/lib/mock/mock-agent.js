import { kClients as _kClients } from "../core/symbols";
import Agent from "../dispatcher/agent";
import { kAgent as _kAgent, kMockAgentSet as _kMockAgentSet, kMockAgentGet as _kMockAgentGet, kDispatches as _kDispatches, kIsMockActive as _kIsMockActive, kNetConnect as _kNetConnect, kGetNetConnect as _kGetNetConnect, kOptions as _kOptions, kFactory as _kFactory, kMockAgentRegisterCallHistory as _kMockAgentRegisterCallHistory, kMockAgentIsCallHistoryEnabled as _kMockAgentIsCallHistoryEnabled, kMockAgentAddCallHistoryLog as _kMockAgentAddCallHistoryLog, kMockAgentMockCallHistoryInstance as _kMockAgentMockCallHistoryInstance, kMockAgentAcceptsNonStandardSearchParameters as _kMockAgentAcceptsNonStandardSearchParameters, kMockCallHistoryAddLog as _kMockCallHistoryAddLog, kIgnoreTrailingSlash as _kIgnoreTrailingSlash } from "./mock-symbols";
import MockClient from "./mock-client";
import MockPool from "./mock-pool";
import { matchValue as _matchValue, normalizeSearchParams as _normalizeSearchParams, buildAndValidateMockOptions as _buildAndValidateMockOptions, normalizeOrigin as _normalizeOrigin } from "./mock-utils";
import { InvalidArgumentError as _InvalidArgumentError, UndiciError as _UndiciError } from "../core/errors";
import Dispatcher from "../dispatcher/dispatcher";
import PendingInterceptorsFormatter from "./pending-interceptors-formatter";
import { MockCallHistory as _MockCallHistory } from "./mock-call-history";
class MockAgent extends Dispatcher {
  constructor(opts = {}) {
    super(opts);
    const mockOptions = _buildAndValidateMockOptions(opts);
    this[_kNetConnect] = true;
    this[_kIsMockActive] = true;
    this[_kMockAgentIsCallHistoryEnabled] = mockOptions.enableCallHistory ?? false;
    this[_kMockAgentAcceptsNonStandardSearchParameters] = mockOptions.acceptNonStandardSearchParameters ?? false;
    this[_kIgnoreTrailingSlash] = mockOptions.ignoreTrailingSlash ?? false;

    // Instantiate Agent and encapsulate
    if (opts?.agent && typeof opts.agent.dispatch !== 'function') {
      throw new _InvalidArgumentError('Argument opts.agent must implement Agent');
    }
    const agent = opts?.agent ? opts.agent : new Agent(opts);
    this[_kAgent] = agent;
    this[_kClients] = agent[_kClients];
    this[_kOptions] = mockOptions;
    if (this[_kMockAgentIsCallHistoryEnabled]) {
      this[_kMockAgentRegisterCallHistory]();
    }
  }
  get(origin) {
    // Normalize origin to handle URL objects and case-insensitive hostnames
    const normalizedOrigin = _normalizeOrigin(origin);
    const originKey = this[_kIgnoreTrailingSlash] ? normalizedOrigin.replace(/\/$/, '') : normalizedOrigin;
    let dispatcher = this[_kMockAgentGet](originKey);
    if (!dispatcher) {
      dispatcher = this[_kFactory](originKey);
      this[_kMockAgentSet](originKey, dispatcher);
    }
    return dispatcher;
  }
  dispatch(opts, handler) {
    opts.origin = _normalizeOrigin(opts.origin);

    // Call MockAgent.get to perform additional setup before dispatching as normal
    this.get(opts.origin);
    this[_kMockAgentAddCallHistoryLog](opts);
    const acceptNonStandardSearchParameters = this[_kMockAgentAcceptsNonStandardSearchParameters];
    const dispatchOpts = {
      ...opts
    };
    if (acceptNonStandardSearchParameters && dispatchOpts.path) {
      const [path, searchParams] = dispatchOpts.path.split('?');
      const normalizedSearchParams = _normalizeSearchParams(searchParams, acceptNonStandardSearchParameters);
      dispatchOpts.path = `${path}?${normalizedSearchParams}`;
    }
    return this[_kAgent].dispatch(dispatchOpts, handler);
  }
  async close() {
    this.clearCallHistory();
    await this[_kAgent].close();
    this[_kClients].clear();
  }
  deactivate() {
    this[_kIsMockActive] = false;
  }
  activate() {
    this[_kIsMockActive] = true;
  }
  enableNetConnect(matcher) {
    if (typeof matcher === 'string' || typeof matcher === 'function' || matcher instanceof RegExp) {
      if (Array.isArray(this[_kNetConnect])) {
        this[_kNetConnect].push(matcher);
      } else {
        this[_kNetConnect] = [matcher];
      }
    } else if (typeof matcher === 'undefined') {
      this[_kNetConnect] = true;
    } else {
      throw new _InvalidArgumentError('Unsupported matcher. Must be one of String|Function|RegExp.');
    }
  }
  disableNetConnect() {
    this[_kNetConnect] = false;
  }
  enableCallHistory() {
    this[_kMockAgentIsCallHistoryEnabled] = true;
    return this;
  }
  disableCallHistory() {
    this[_kMockAgentIsCallHistoryEnabled] = false;
    return this;
  }
  getCallHistory() {
    return this[_kMockAgentMockCallHistoryInstance];
  }
  clearCallHistory() {
    if (this[_kMockAgentMockCallHistoryInstance] !== undefined) {
      this[_kMockAgentMockCallHistoryInstance].clear();
    }
  }

  // This is required to bypass issues caused by using global symbols - see:
  // https://github.com/nodejs/undici/issues/1447
  get isMockActive() {
    return this[_kIsMockActive];
  }
  [_kMockAgentRegisterCallHistory]() {
    if (this[_kMockAgentMockCallHistoryInstance] === undefined) {
      this[_kMockAgentMockCallHistoryInstance] = new _MockCallHistory();
    }
  }
  [_kMockAgentAddCallHistoryLog](opts) {
    if (this[_kMockAgentIsCallHistoryEnabled]) {
      // additional setup when enableCallHistory class method is used after mockAgent instantiation
      this[_kMockAgentRegisterCallHistory]();

      // add call history log on every call (intercepted or not)
      this[_kMockAgentMockCallHistoryInstance][_kMockCallHistoryAddLog](opts);
    }
  }
  [_kMockAgentSet](origin, dispatcher) {
    this[_kClients].set(origin, dispatcher);
  }
  [_kFactory](origin) {
    const mockOptions = Object.assign({
      agent: this
    }, this[_kOptions]);
    return this[_kOptions] && this[_kOptions].connections === 1 ? new MockClient(origin, mockOptions) : new MockPool(origin, mockOptions);
  }
  [_kMockAgentGet](origin) {
    // First check if we can immediately find it
    const dispatcher = this[_kClients].get(origin);
    if (dispatcher) {
      return dispatcher;
    }

    // If the origin is not a string create a dummy parent pool and return to user
    if (typeof origin !== 'string') {
      const dispatcher = this[_kFactory]('http://localhost:9999');
      this[_kMockAgentSet](origin, dispatcher);
      return dispatcher;
    }

    // If we match, create a pool and assign the same dispatches
    for (const [keyMatcher, nonExplicitDispatcher] of Array.from(this[_kClients])) {
      if (nonExplicitDispatcher && typeof keyMatcher !== 'string' && _matchValue(keyMatcher, origin)) {
        const dispatcher = this[_kFactory](origin);
        this[_kMockAgentSet](origin, dispatcher);
        dispatcher[_kDispatches] = nonExplicitDispatcher[_kDispatches];
        return dispatcher;
      }
    }
  }
  [_kGetNetConnect]() {
    return this[_kNetConnect];
  }
  pendingInterceptors() {
    const mockAgentClients = this[_kClients];
    return Array.from(mockAgentClients.entries()).flatMap(([origin, dispatcher]) => dispatcher[_kDispatches].map(dispatch => ({
      ...dispatch,
      origin
    }))).filter(({
      pending
    }) => pending);
  }
  assertNoPendingInterceptors({
    pendingInterceptorsFormatter = new PendingInterceptorsFormatter()
  } = {}) {
    const pending = this.pendingInterceptors();
    if (pending.length === 0) {
      return;
    }
    throw new _UndiciError(pending.length === 1 ? `1 interceptor is pending:\n\n${pendingInterceptorsFormatter.format(pending)}`.trim() : `${pending.length} interceptors are pending:\n\n${pendingInterceptorsFormatter.format(pending)}`.trim());
  }
}
const _cjs_default = MockAgent;
export default _cjs_default;
