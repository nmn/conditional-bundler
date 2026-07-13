import { parseSetCookie as _parseSetCookie } from "./parse";
import { stringify as _stringify } from "./util";
import { webidl as _webidl } from "../webidl";
import { Headers as _Headers } from "../fetch/headers";
const brandChecks = _webidl.brandCheckMultiple([_Headers, globalThis.Headers].filter(Boolean));

/**
 * @typedef {Object} Cookie
 * @property {string} name
 * @property {string} value
 * @property {Date|number} [expires]
 * @property {number} [maxAge]
 * @property {string} [domain]
 * @property {string} [path]
 * @property {boolean} [secure]
 * @property {boolean} [httpOnly]
 * @property {'Strict'|'Lax'|'None'} [sameSite]
 * @property {string[]} [unparsed]
 */

/**
 * @param {Headers} headers
 * @returns {Record<string, string>}
 */
function getCookies(headers) {
  _webidl.argumentLengthCheck(arguments, 1, 'getCookies');
  brandChecks(headers);
  const cookie = headers.get('cookie');

  /** @type {Record<string, string>} */
  const out = {};
  if (!cookie) {
    return out;
  }
  for (const piece of cookie.split(';')) {
    const [name, ...value] = piece.split('=');
    out[name.trim()] = value.join('=');
  }
  return out;
}

/**
 * @param {Headers} headers
 * @param {string} name
 * @param {{ path?: string, domain?: string }|undefined} attributes
 * @returns {void}
 */
function deleteCookie(headers, name, attributes) {
  brandChecks(headers);
  const prefix = 'deleteCookie';
  _webidl.argumentLengthCheck(arguments, 2, prefix);
  name = _webidl.converters.DOMString(name, prefix, 'name');
  attributes = _webidl.converters.DeleteCookieAttributes(attributes);

  // Matches behavior of
  // https://github.com/denoland/deno_std/blob/63827b16330b82489a04614027c33b7904e08be5/http/cookie.ts#L278
  setCookie(headers, {
    name,
    value: '',
    expires: new Date(0),
    ...attributes
  });
}

/**
 * @param {Headers} headers
 * @returns {Cookie[]}
 */
function getSetCookies(headers) {
  _webidl.argumentLengthCheck(arguments, 1, 'getSetCookies');
  brandChecks(headers);
  const cookies = headers.getSetCookie();
  if (!cookies) {
    return [];
  }
  return cookies.map(pair => _parseSetCookie(pair));
}

/**
 * Parses a cookie string
 * @param {string} cookie
 */
function parseCookie(cookie) {
  cookie = _webidl.converters.DOMString(cookie);
  return _parseSetCookie(cookie);
}

/**
 * @param {Headers} headers
 * @param {Cookie} cookie
 * @returns {void}
 */
function setCookie(headers, cookie) {
  _webidl.argumentLengthCheck(arguments, 2, 'setCookie');
  brandChecks(headers);
  cookie = _webidl.converters.Cookie(cookie);
  const str = _stringify(cookie);
  if (str) {
    headers.append('set-cookie', str, true);
  }
}
_webidl.converters.DeleteCookieAttributes = _webidl.dictionaryConverter([{
  converter: _webidl.nullableConverter(_webidl.converters.DOMString),
  key: 'path',
  defaultValue: () => null
}, {
  converter: _webidl.nullableConverter(_webidl.converters.DOMString),
  key: 'domain',
  defaultValue: () => null
}]);
_webidl.converters.Cookie = _webidl.dictionaryConverter([{
  converter: _webidl.converters.DOMString,
  key: 'name'
}, {
  converter: _webidl.converters.DOMString,
  key: 'value'
}, {
  converter: _webidl.nullableConverter(value => {
    if (typeof value === 'number') {
      return _webidl.converters['unsigned long long'](value);
    }
    return new Date(value);
  }),
  key: 'expires',
  defaultValue: () => null
}, {
  converter: _webidl.nullableConverter(_webidl.converters['long long']),
  key: 'maxAge',
  defaultValue: () => null
}, {
  converter: _webidl.nullableConverter(_webidl.converters.DOMString),
  key: 'domain',
  defaultValue: () => null
}, {
  converter: _webidl.nullableConverter(_webidl.converters.DOMString),
  key: 'path',
  defaultValue: () => null
}, {
  converter: _webidl.nullableConverter(_webidl.converters.boolean),
  key: 'secure',
  defaultValue: () => null
}, {
  converter: _webidl.nullableConverter(_webidl.converters.boolean),
  key: 'httpOnly',
  defaultValue: () => null
}, {
  converter: _webidl.converters.USVString,
  key: 'sameSite',
  allowedValues: ['Strict', 'Lax', 'None']
}, {
  converter: _webidl.sequenceConverter(_webidl.converters.DOMString),
  key: 'unparsed',
  defaultValue: () => []
}]);
const _cjs_default = {
  getCookies,
  deleteCookie,
  getSetCookies,
  setCookie,
  parseCookie
};
const _getCookies = _cjs_default["getCookies"];
export { _getCookies as getCookies };
const _deleteCookie = _cjs_default["deleteCookie"];
export { _deleteCookie as deleteCookie };
const _getSetCookies = _cjs_default["getSetCookies"];
export { _getSetCookies as getSetCookies };
const _setCookie = _cjs_default["setCookie"];
export { _setCookie as setCookie };
const _parseCookie = _cjs_default["parseCookie"];
export { _parseCookie as parseCookie };
export default _cjs_default;
