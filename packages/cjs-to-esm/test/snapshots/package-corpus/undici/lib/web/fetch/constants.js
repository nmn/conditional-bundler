const corsSafeListedMethods = /** @type {const} */['GET', 'HEAD', 'POST'];
const corsSafeListedMethodsSet = new Set(corsSafeListedMethods);
const nullBodyStatus = /** @type {const} */[101, 204, 205, 304];
const redirectStatus = /** @type {const} */[301, 302, 303, 307, 308];
const redirectStatusSet = new Set(redirectStatus);

/**
 * @see https://fetch.spec.whatwg.org/#block-bad-port
 */
const badPorts = /** @type {const} */['1', '7', '9', '11', '13', '15', '17', '19', '20', '21', '22', '23', '25', '37', '42', '43', '53', '69', '77', '79', '87', '95', '101', '102', '103', '104', '109', '110', '111', '113', '115', '117', '119', '123', '135', '137', '139', '143', '161', '179', '389', '427', '465', '512', '513', '514', '515', '526', '530', '531', '532', '540', '548', '554', '556', '563', '587', '601', '636', '989', '990', '993', '995', '1719', '1720', '1723', '2049', '3659', '4045', '4190', '5060', '5061', '6000', '6566', '6665', '6666', '6667', '6668', '6669', '6679', '6697', '10080'];
const badPortsSet = new Set(badPorts);

/**
 * @see https://w3c.github.io/webappsec-referrer-policy/#referrer-policy-header
 */
const referrerPolicyTokens = /** @type {const} */['no-referrer', 'no-referrer-when-downgrade', 'same-origin', 'origin', 'strict-origin', 'origin-when-cross-origin', 'strict-origin-when-cross-origin', 'unsafe-url'];

/**
 * @see https://w3c.github.io/webappsec-referrer-policy/#referrer-policies
 */
const referrerPolicy = /** @type {const} */['', ...referrerPolicyTokens];
const referrerPolicyTokensSet = new Set(referrerPolicyTokens);
const requestRedirect = /** @type {const} */['follow', 'manual', 'error'];
const safeMethods = /** @type {const} */['GET', 'HEAD', 'OPTIONS', 'TRACE', 'QUERY'];
const safeMethodsSet = new Set(safeMethods);
const requestMode = /** @type {const} */['navigate', 'same-origin', 'no-cors', 'cors'];
const requestCredentials = /** @type {const} */['omit', 'same-origin', 'include'];
const requestCache = /** @type {const} */['default', 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'];

/**
 * @see https://fetch.spec.whatwg.org/#request-body-header-name
 */
const requestBodyHeader = /** @type {const} */['content-encoding', 'content-language', 'content-location', 'content-type',
// See https://github.com/nodejs/undici/issues/2021
// 'Content-Length' is a forbidden header name, which is typically
// removed in the Headers implementation. However, undici doesn't
// filter out headers, so we add it here.
'content-length'];

/**
 * @see https://fetch.spec.whatwg.org/#enumdef-requestduplex
 */
const requestDuplex = /** @type {const} */['half'];

/**
 * @see http://fetch.spec.whatwg.org/#forbidden-method
 */
const forbiddenMethods = /** @type {const} */['CONNECT', 'TRACE', 'TRACK'];
const forbiddenMethodsSet = new Set(forbiddenMethods);
const subresource = /** @type {const} */['audio', 'audioworklet', 'font', 'image', 'manifest', 'paintworklet', 'script', 'style', 'track', 'video', 'xslt', ''];
const subresourceSet = new Set(subresource);
const _cjs_default = {
  subresource,
  forbiddenMethods,
  requestBodyHeader,
  referrerPolicy,
  requestRedirect,
  requestMode,
  requestCredentials,
  requestCache,
  redirectStatus,
  corsSafeListedMethods,
  nullBodyStatus,
  safeMethods,
  badPorts,
  requestDuplex,
  subresourceSet,
  badPortsSet,
  redirectStatusSet,
  corsSafeListedMethodsSet,
  safeMethodsSet,
  forbiddenMethodsSet,
  referrerPolicyTokens: referrerPolicyTokensSet
};
const _subresource = _cjs_default["subresource"];
export { _subresource as subresource };
const _forbiddenMethods = _cjs_default["forbiddenMethods"];
export { _forbiddenMethods as forbiddenMethods };
const _requestBodyHeader = _cjs_default["requestBodyHeader"];
export { _requestBodyHeader as requestBodyHeader };
const _referrerPolicy = _cjs_default["referrerPolicy"];
export { _referrerPolicy as referrerPolicy };
const _requestRedirect = _cjs_default["requestRedirect"];
export { _requestRedirect as requestRedirect };
const _requestMode = _cjs_default["requestMode"];
export { _requestMode as requestMode };
const _requestCredentials = _cjs_default["requestCredentials"];
export { _requestCredentials as requestCredentials };
const _requestCache = _cjs_default["requestCache"];
export { _requestCache as requestCache };
const _redirectStatus = _cjs_default["redirectStatus"];
export { _redirectStatus as redirectStatus };
const _corsSafeListedMethods = _cjs_default["corsSafeListedMethods"];
export { _corsSafeListedMethods as corsSafeListedMethods };
const _nullBodyStatus = _cjs_default["nullBodyStatus"];
export { _nullBodyStatus as nullBodyStatus };
const _safeMethods = _cjs_default["safeMethods"];
export { _safeMethods as safeMethods };
const _badPorts = _cjs_default["badPorts"];
export { _badPorts as badPorts };
const _requestDuplex = _cjs_default["requestDuplex"];
export { _requestDuplex as requestDuplex };
const _subresourceSet = _cjs_default["subresourceSet"];
export { _subresourceSet as subresourceSet };
const _badPortsSet = _cjs_default["badPortsSet"];
export { _badPortsSet as badPortsSet };
const _redirectStatusSet = _cjs_default["redirectStatusSet"];
export { _redirectStatusSet as redirectStatusSet };
const _corsSafeListedMethodsSet = _cjs_default["corsSafeListedMethodsSet"];
export { _corsSafeListedMethodsSet as corsSafeListedMethodsSet };
const _safeMethodsSet = _cjs_default["safeMethodsSet"];
export { _safeMethodsSet as safeMethodsSet };
const _forbiddenMethodsSet = _cjs_default["forbiddenMethodsSet"];
export { _forbiddenMethodsSet as forbiddenMethodsSet };
const _referrerPolicyTokens = _cjs_default["referrerPolicyTokens"];
export { _referrerPolicyTokens as referrerPolicyTokens };
export default _cjs_default;
