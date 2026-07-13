import { parse as _parse } from "cookie";
import { unsign as _unsign } from "cookie-signature";
/**
 * Module dependencies.
 * @private
 */

/**
 * Module exports.
 * @public
 */

export default Object.assign(cookieParser, {
  JSONCookie,
  JSONCookies,
  signedCookie,
  signedCookies
});
/**
 * Parse Cookie header and populate `req.cookies`
 * with an object keyed by the cookie names.
 *
 * @param {string|array} [secret] A string (or array of strings) representing cookie signing secret(s).
 * @param {Object} [options]
 * @return {Function}
 * @public
 */

function cookieParser(secret, options) {
  var secrets = !secret || Array.isArray(secret) ? secret || [] : [secret];
  return function cookieParser(req, res, next) {
    if (req.cookies) {
      return next();
    }
    var cookies = req.headers.cookie;
    req.secret = secrets[0];
    req.cookies = Object.create(null);
    req.signedCookies = Object.create(null);

    // no cookies
    if (!cookies) {
      return next();
    }
    req.cookies = _parse(cookies, options);

    // parse signed cookies
    if (secrets.length !== 0) {
      req.signedCookies = signedCookies(req.cookies, secrets);
      req.signedCookies = JSONCookies(req.signedCookies);
    }

    // parse JSON cookies
    req.cookies = JSONCookies(req.cookies);
    next();
  };
}

/**
 * Parse JSON cookie string.
 *
 * @param {String} str
 * @return {Object} Parsed object or undefined if not json cookie
 * @public
 */
export function JSONCookie(str) {
  if (typeof str !== 'string' || str.substr(0, 2) !== 'j:') {
    return undefined;
  }
  try {
    return JSON.parse(str.slice(2));
  } catch (err) {
    return undefined;
  }
}
/**
 * Parse JSON cookies.
 *
 * @param {Object} obj
 * @return {Object}
 * @public
 */
export function JSONCookies(obj) {
  var cookies = Object.keys(obj);
  var key;
  var val;
  for (var i = 0; i < cookies.length; i++) {
    key = cookies[i];
    val = JSONCookie(obj[key]);
    if (val) {
      obj[key] = val;
    }
  }
  return obj;
}
/**
 * Parse a signed cookie string, return the decoded value.
 *
 * @param {String} str signed cookie string
 * @param {string|array} secret
 * @return {String} decoded value
 * @public
 */
export function signedCookie(str, secret) {
  if (typeof str !== 'string') {
    return undefined;
  }
  if (str.substr(0, 2) !== 's:') {
    return str;
  }
  var secrets = !secret || Array.isArray(secret) ? secret || [] : [secret];
  for (var i = 0; i < secrets.length; i++) {
    var val = _unsign(str.slice(2), secrets[i]);
    if (val !== false) {
      return val;
    }
  }
  return false;
}
/**
 * Parse signed cookies, returning an object containing the decoded key/value
 * pairs, while removing the signed key from obj.
 *
 * @param {Object} obj
 * @param {string|array} secret
 * @return {Object}
 * @public
 */
export function signedCookies(obj, secret) {
  var cookies = Object.keys(obj);
  var dec;
  var key;
  var ret = Object.create(null);
  var val;
  for (var i = 0; i < cookies.length; i++) {
    key = cookies[i];
    val = obj[key];
    dec = signedCookie(val, secret);
    if (val !== dec) {
      ret[key] = dec;
      delete obj[key];
    }
  }
  return ret;
}
