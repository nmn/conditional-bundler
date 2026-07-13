const createUpdateDetails = (success, source, initDuration, error, sourceUrl, warnings) => {
  return {
    duration: initDuration,
    source,
    success,
    error,
    sourceUrl,
    warnings
  };
};
export { createUpdateDetails };
const _UPDATE_DETAIL_ERROR_MESSAGES = {
  NO_NETWORK_DATA: 'No data was returned from the network. This may be due to a network timeout if a timeout value was specified in the options or ad blocker error.'
};
export { _UPDATE_DETAIL_ERROR_MESSAGES as UPDATE_DETAIL_ERROR_MESSAGES };
const _cjs_default = {
  ["UPDATE_DETAIL_ERROR_MESSAGES"]: _UPDATE_DETAIL_ERROR_MESSAGES,
  ["createUpdateDetails"]: createUpdateDetails
};
export default _cjs_default;
