(() => {
  const PREFIX = "[AI Text Editor]";
  const log = (...args) => console.log(PREFIX, ...args);
  const warn = (...args) => console.warn(PREFIX, ...args);
  const error = (...args) => console.error(PREFIX, ...args);
  globalThis.AITextLogger = Object.freeze({ log, warn, error });
})();
