import * as _cjs_import from "node:util";
const {
  format
} = _cjs_import;

/**
 * Set of simple deprecation notices and a way to expose them for a set of
 * properties.
 * @type {Object}
 * @private
 */
const _warn = {
  deprecated(prop) {
    return () => {
      throw new Error(format('{ %s } was removed in winston@3.0.0.', prop));
    };
  },
  useFormat(prop) {
    return () => {
      throw new Error([format('{ %s } was removed in winston@3.0.0.', prop), 'Use a custom winston.format = winston.format(function) instead.'].join('\n'));
    };
  },
  forFunctions(obj, type, props) {
    props.forEach(prop => {
      obj[prop] = _warn[type](prop);
    });
  },
  forProperties(obj, type, props) {
    props.forEach(prop => {
      const notice = _warn[type](prop);
      Object.defineProperty(obj, prop, {
        get: notice,
        set: notice
      });
    });
  }
};
export { _warn as warn };
const _cjs_default = {
  ["warn"]: _warn
};
export default _cjs_default;
