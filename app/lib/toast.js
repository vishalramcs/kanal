// Global toast bus.
const subs = new Set();
export const notify = (message) => subs.forEach((fn) => fn(message));
export const onNotify = (fn) => (subs.add(fn), () => subs.delete(fn));
