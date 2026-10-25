// Promise.withResolvers (Safari 17.4) and Promise.try (Safari 18.2), for browsers without them.
// Imported for its side effect, before pdf.js, in the page and in the worker.
type P = PromiseConstructor & { try?: unknown; withResolvers?: unknown }
const P = Promise as P
if (!P.withResolvers)
  P.withResolvers = function <T>() {
    let resolve!: (v: T | PromiseLike<T>) => void
    let reject!: (e?: unknown) => void
    const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
    return { promise, resolve, reject }
  }
if (!P.try)
  P.try = function (fn: (...a: unknown[]) => unknown, ...args: unknown[]) {
    return new Promise((resolve) => resolve(fn(...args)))
  }
export {}
