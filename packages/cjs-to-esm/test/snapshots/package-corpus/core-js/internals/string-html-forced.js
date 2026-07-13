import fails from "../internals/fails";
// check the existence of a method, lowercase
// of a tag and escaping quotes in arguments
const _cjs_default = function (METHOD_NAME) {
  return fails(function () {
    var test = ''[METHOD_NAME]('"');
    return test !== test.toLowerCase() || test.split('"').length > 3;
  });
};
export default _cjs_default;
