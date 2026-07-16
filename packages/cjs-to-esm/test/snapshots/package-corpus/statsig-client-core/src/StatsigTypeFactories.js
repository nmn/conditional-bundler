import Log_1 from "./Log";
import TypingUtils_1 from "./TypingUtils";
function _makeEvaluation(name, details, evaluation, value) {
  var _a;
  return {
    name,
    details,
    ruleID: (_a = evaluation === null || evaluation === void 0 ? void 0 : evaluation.rule_id) !== null && _a !== void 0 ? _a : '',
    __evaluation: evaluation,
    value
  };
}
export function _makeFeatureGate(name, details, evaluation) {
  var _a;
  return Object.assign(Object.assign({}, _makeEvaluation(name, details, evaluation, (evaluation === null || evaluation === void 0 ? void 0 : evaluation.value) === true)), {
    idType: (_a = evaluation === null || evaluation === void 0 ? void 0 : evaluation.id_type) !== null && _a !== void 0 ? _a : null
  });
}
export function _makeDynamicConfig(name, details, evaluation) {
  var _a, _b;
  const value = (_a = evaluation === null || evaluation === void 0 ? void 0 : evaluation.value) !== null && _a !== void 0 ? _a : {};
  return Object.assign(Object.assign({}, _makeEvaluation(name, details, evaluation, value)), {
    idType: (_b = evaluation === null || evaluation === void 0 ? void 0 : evaluation.id_type) !== null && _b !== void 0 ? _b : null,
    get: _makeTypedGet(name, evaluation === null || evaluation === void 0 ? void 0 : evaluation.value)
  });
}
export function _makeExperiment(name, details, evaluation) {
  var _a;
  const result = _makeDynamicConfig(name, details, evaluation);
  return Object.assign(Object.assign({}, result), {
    groupName: (_a = evaluation === null || evaluation === void 0 ? void 0 : evaluation.group_name) !== null && _a !== void 0 ? _a : null
  });
}
export function _makeLayer(name, details, evaluation, exposeFunc) {
  var _a, _b;
  return Object.assign(Object.assign({}, _makeEvaluation(name, details, evaluation, undefined)), {
    get: _makeTypedGet(name, evaluation === null || evaluation === void 0 ? void 0 : evaluation.value, exposeFunc),
    groupName: (_a = evaluation === null || evaluation === void 0 ? void 0 : evaluation.group_name) !== null && _a !== void 0 ? _a : null,
    __value: (_b = evaluation === null || evaluation === void 0 ? void 0 : evaluation.value) !== null && _b !== void 0 ? _b : {}
  });
}
export function _mergeOverride(original, overridden, value, exposeFunc) {
  return Object.assign(Object.assign(Object.assign({}, original), overridden), {
    get: _makeTypedGet(original.name, value, exposeFunc)
  });
}
export function _makeTypedGet(name, value, exposeFunc) {
  return (param, fallback) => {
    var _a;
    const found = (_a = value === null || value === void 0 ? void 0 : value[param]) !== null && _a !== void 0 ? _a : null;
    if (found == null) {
      return fallback !== null && fallback !== void 0 ? fallback : null;
    }
    if (fallback != null && !(0, TypingUtils_1._isTypeMatch)(found, fallback)) {
      Log_1.Log.warn(`Parameter type mismatch. '${name}.${param}' was found to be type '${typeof found}' but fallback/return type is '${typeof fallback}'. See https://docs.statsig.com/client/javascript-sdk/#typed-getters`);
      return fallback !== null && fallback !== void 0 ? fallback : null;
    }
    exposeFunc === null || exposeFunc === void 0 ? void 0 : exposeFunc(param);
    return found;
  };
}
const _cjs_default = {
  ["_makeTypedGet"]: _makeTypedGet,
  ["_mergeOverride"]: _mergeOverride,
  ["_makeLayer"]: _makeLayer,
  ["_makeExperiment"]: _makeExperiment,
  ["_makeDynamicConfig"]: _makeDynamicConfig,
  ["_makeFeatureGate"]: _makeFeatureGate
};
export default _cjs_default;
