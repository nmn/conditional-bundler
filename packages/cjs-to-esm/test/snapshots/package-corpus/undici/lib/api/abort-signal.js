import { addAbortListener as _addAbortListener } from "../core/util";
import { RequestAbortedError as _RequestAbortedError } from "../core/errors";
const kListener = Symbol('kListener');
const kSignal = Symbol('kSignal');
function abort(self) {
  if (self.abort) {
    self.abort(self[kSignal]?.reason);
  } else {
    self.reason = self[kSignal]?.reason ?? new _RequestAbortedError();
  }
  removeSignal(self);
}
function addSignal(self, signal) {
  self.reason = null;
  self[kSignal] = null;
  self[kListener] = null;
  if (!signal) {
    return;
  }
  if (signal.aborted) {
    abort(self);
    return;
  }
  self[kSignal] = signal;
  self[kListener] = () => {
    abort(self);
  };
  _addAbortListener(self[kSignal], self[kListener]);
}
function removeSignal(self) {
  if (!self[kSignal]) {
    return;
  }
  if ('removeEventListener' in self[kSignal]) {
    self[kSignal].removeEventListener('abort', self[kListener]);
  } else {
    self[kSignal].removeListener('abort', self[kListener]);
  }
  self[kSignal] = null;
  self[kListener] = null;
}
const _cjs_default = {
  addSignal,
  removeSignal
};
const _addSignal = _cjs_default["addSignal"];
export { _addSignal as addSignal };
const _removeSignal = _cjs_default["removeSignal"];
export { _removeSignal as removeSignal };
export default _cjs_default;
