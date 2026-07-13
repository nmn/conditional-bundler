import RetryHandler from "../handler/retry-handler";
const _cjs_default = globalOpts => {
  return dispatch => {
    return function retryInterceptor(opts, handler) {
      return dispatch(opts, new RetryHandler({
        ...opts,
        retryOptions: {
          ...globalOpts,
          ...opts.retryOptions
        }
      }, {
        handler,
        dispatch
      }));
    };
  };
};
export default _cjs_default;
