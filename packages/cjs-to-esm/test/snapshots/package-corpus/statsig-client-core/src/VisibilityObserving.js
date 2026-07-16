import SafeJs_1 from "./SafeJs";
const FOREGROUND = 'foreground';
const BACKGROUND = 'background';
const LISTENERS = [];
let current = FOREGROUND;
let isUnloading = false;
const _isCurrentlyVisible = () => {
  return current === FOREGROUND;
};
export { _isCurrentlyVisible };
const _isUnloading = () => isUnloading;
export { _isUnloading };
const _subscribeToVisiblityChanged = listener => {
  LISTENERS.unshift(listener);
};
export { _subscribeToVisiblityChanged };
const _notifyVisibilityChanged = visibility => {
  if (visibility === current) {
    return;
  }
  current = visibility;
  LISTENERS.forEach(l => l(visibility));
};
export { _notifyVisibilityChanged };
(0, SafeJs_1._addWindowEventListenerSafe)('focus', () => {
  isUnloading = false;
  (0, _notifyVisibilityChanged)(FOREGROUND);
});
(0, SafeJs_1._addWindowEventListenerSafe)('blur', () => (0, _notifyVisibilityChanged)(BACKGROUND));
(0, SafeJs_1._addDocumentEventListenerSafe)('visibilitychange', () => {
  (0, _notifyVisibilityChanged)(document.visibilityState === 'visible' ? FOREGROUND : BACKGROUND);
});
(0, SafeJs_1._addWindowEventListenerSafe)((0, SafeJs_1._getUnloadEvent)(), () => {
  isUnloading = true;
  (0, _notifyVisibilityChanged)(BACKGROUND);
});
const _cjs_default = {
  ["_notifyVisibilityChanged"]: _notifyVisibilityChanged,
  ["_subscribeToVisiblityChanged"]: _subscribeToVisiblityChanged,
  ["_isUnloading"]: _isUnloading,
  ["_isCurrentlyVisible"]: _isCurrentlyVisible
};
export default _cjs_default;
