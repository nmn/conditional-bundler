import _cjs_import from "../core/errors";
const {
  UndiciError
} = _cjs_import;
const kMockNotMatchedError = Symbol.for('undici.error.UND_MOCK_ERR_MOCK_NOT_MATCHED');

/**
 * The request does not match any registered mock dispatches.
 */
class MockNotMatchedError extends UndiciError {
  constructor(message) {
    super(message);
    this.name = 'MockNotMatchedError';
    this.message = message || 'The request does not match any registered mock dispatches';
    this.code = 'UND_MOCK_ERR_MOCK_NOT_MATCHED';
  }
  static [Symbol.hasInstance](instance) {
    return instance && instance[kMockNotMatchedError] === true;
  }
  get [kMockNotMatchedError]() {
    return true;
  }
}
const _cjs_default = {
  MockNotMatchedError
};
const _MockNotMatchedError = _cjs_default["MockNotMatchedError"];
export { _MockNotMatchedError as MockNotMatchedError };
export default _cjs_default;
