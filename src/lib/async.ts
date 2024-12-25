import { noop } from "./utils";

export type AwaitedCollection<T> = {
  [key in keyof T]: Awaited<T[key]>;
};

export type WaitAll = {
  /**
   * Handles an array of promises and returns their resolved values.
   *
   * - If any promise is pending, it will throw a promise object that resolves when all promises resolve.
   * - If any promise is rejected, it will throw the rejection reason.
   * - If all promises resolve, it will return an array of resolved values.
   *
   * @example
   * const promises = [Promise.resolve(1), Promise.resolve(2)];
   * const result = waitAll(promises); // [1, 2]
   *
   * const rejectedPromises = [Promise.resolve(1), Promise.reject('error')];
   * try {
   *   waitAll(rejectedPromises);
   * } catch (e) {
   *   console.log(e); // 'error'
   * }
   */
  <const T extends readonly PromiseLike<any>[]>(
    promises: T
  ): AwaitedCollection<T>;

  /**
   * Processes an array of promises and invokes callbacks based on their status.
   *
   * - Invokes `onResolved` with an array of resolved values if all promises resolve.
   * - Invokes `onRejected` with the rejection reason if any promise rejects.
   *
   * @example
   * const promises = [Promise.resolve(1), Promise.resolve(2)];
   * waitAll(promises, (values) => console.log(values), (error) => console.log(error));
   */
  <const T extends readonly PromiseLike<any>[]>(
    promises: T,
    onResolved: (values: AwaitedCollection<T>) => void,
    onRejected?: (reason: unknown) => void,
    onPending?: VoidFunction
  ): void;
};

export type WaitAny = {
  /**
   * Handles a collection of named promises and returns the first resolved value.
   *
   * - Throws a promise object if all promises are pending.
   * - Returns an object containing the first resolved promise's key and value.
   * - Throws the rejection reason if a promise rejects and no other promises resolve.
   *
   * @example
   * const promises = { a: Promise.resolve(1), b: Promise.reject('error') };
   * const result = waitAny(promises); // { a: 1 }
   *
   * const allPending = { a: new Promise(() => {}), b: new Promise(() => {}) };
   * try {
   *   waitAny(allPending);
   * } catch (e) {
   *   console.log(e); // A promise object
   * }
   */
  <T extends Record<string, PromiseLike<any>>>(
    promises: T
  ): AwaitedCollection<T>;

  /**
   * Processes a collection of named promises and invokes callbacks based on their status.
   *
   * - Invokes `onResolved` with the first resolved value.
   * - Invokes `onRejected` with the rejection reason if a promise rejects and no others resolve.
   *
   * @example
   * const promises = { a: Promise.resolve(1), b: Promise.reject('error') };
   * waitAny(promises, (value) => console.log(value), (error) => console.log(error));
   */
  <T extends Record<string, PromiseLike<any>>>(
    promises: T,
    onResolved: (values: AwaitedCollection<T>) => void,
    onRejected?: (reason: unknown) => void,
    onPending?: VoidFunction
  ): void;
};

type PromiseResult = {
  status: "pending" | "resolved" | "rejected";
  value: any;
  version?: any;
};

const promiseResults = new WeakMap<PromiseLike<any>, PromiseResult>();

/**
 * Retrieves the result of a promise, including its status (`pending`, `resolved`, or `rejected`)
 * and the associated value or error. If no result exists, it initializes tracking for the promise.
 *
 * @param promise - The promise to retrieve the result for.
 * @returns The result object containing the status and value or reason.
 */
export function getResult(promise: PromiseLike<any>) {
  // eslint-disable-next-line prefer-const
  let result = promiseResults.get(promise);
  if (result) {
    return result;
  }
  const newResult: PromiseResult = { status: "pending", value: undefined };
  setResult(promise, newResult);
  promise.then(
    (value) => {
      newResult.status = "resolved";
      newResult.value = value;
    },
    (reason) => {
      newResult.status = "rejected";
      newResult.value = reason;
    }
  );
  return newResult;
}

/**
 * Associates a known result with a promise for status tracking.
 *
 * @param promise - The promise to associate the result with.
 * @param result - The result object containing status and value or reason.
 * @returns The promise with the associated result.
 */
export function setResult<T extends PromiseLike<any>>(
  promise: T,
  result: PromiseResult
) {
  if (!promise) {
    throw new Error("aaa");
  }

  const existingResult = promiseResults.get(promise);
  const finalResult = existingResult
    ? Object.assign(existingResult, result)
    : result;
  finalResult.version = {};
  promiseResults.set(promise, finalResult);

  return promise;
}

/**
 * Checks whether a value is a promise or promise-like object.
 *
 * @param value - The value to check.
 * @returns `true` if the value is promise-like, `false` otherwise.
 */
export function isPromiseLike<T>(value: any): value is PromiseLike<T> {
  return !!value && typeof value.then === "function";
}

/**
 * Converts a value into a promise. If the value is already a promise, it is returned as-is.
 * Functions are executed and their results are wrapped in a promise.
 *
 * @param value - The value to convert.
 * @returns A promise resolving to the value or result of the function.
 */
export function convertToPromise<T>(value: any): PromiseLike<T> {
  if (isPromiseLike<T>(value)) {
    return value;
  }

  if (typeof value === "function") {
    try {
      return convertToPromise(value());
    } catch (ex) {
      return Promise.reject(ex);
    }
  }

  return Promise.resolve(value);
}

/**
 * Creates a resolved promise with a predefined result.
 *
 * @param value - The value to resolve.
 * @returns A promise resolved with the specified value.
 */
export function resolved<T>(value: T): Promise<T> {
  return setResult(Promise.resolve(value), {
    status: "resolved",
    value,
  });
}

/**
 * Creates a rejected promise with a predefined reason.
 *
 * @param reason - The rejection reason.
 * @returns A promise rejected with the specified reason.
 */
export function rejected<T>(reason: unknown): Promise<T> {
  const rejectedPromise = Promise.reject(reason);
  rejectedPromise.catch(noop);
  return setResult(rejectedPromise, {
    status: "rejected",
    value: reason,
  });
}

export const waitAll: WaitAll = (values, ...args: any[]): any => {
  const results = values.map(getResult);
  // overload: waitAll(values, onResolved, onRejected)
  const isOverloadWithOnResolved = args.length > 0;
  const [onResolved, onRejected, onPending] = args;
  const rejectedResult = results.find((x) => x.status === "rejected");
  if (rejectedResult) {
    if (isOverloadWithOnResolved) {
      onRejected?.(rejectedResult.value);
      return;
    }

    throw rejectedResult.value;
  }
  const hasPending = results.some((x) => x.status === "pending");
  if (hasPending) {
    const promiseAll = Promise.all(values);
    if (isOverloadWithOnResolved) {
      onPending?.();
      promiseAll.then(onResolved, onRejected);
      return;
    }

    throw promiseAll;
  }

  const resolvedValues = results.map((x) => x.value);
  if (isOverloadWithOnResolved) {
    onResolved(resolvedValues);
    return;
  }

  return resolvedValues;
};

export const waitAny: WaitAny = (values, ...args: any[]): any => {
  const results = Object.entries(values).map(([key, value]) => ({
    key,
    result: getResult(value),
    promise: value,
  }));

  // overload: waitAny(values, onResolved, onRejected)
  const isOverloadWithOnResolved = args.length > 0;
  const [onResolved, onRejected, onPending] = args;
  let resolvedResult: any | undefined;
  const resolvedOrRejected = results.some(({ key, result }) => {
    if (result.status === "rejected") {
      if (isOverloadWithOnResolved) {
        onRejected?.(result.value);
        return true;
      }

      throw result.value;
    }

    if (result.status === "resolved") {
      resolvedResult = { [key]: result.value };
      return true;
    }

    return false;
  });

  if (resolvedResult) {
    if (isOverloadWithOnResolved) {
      onResolved(resolvedResult);
      return true;
    }

    return resolvedResult;
  }

  if (resolvedOrRejected) {
    return;
  }

  const promiseRace = Promise.race(results.map((x) => x.promise));

  if (isOverloadWithOnResolved) {
    onPending?.();
    promiseRace.then(onResolved, onRejected);
    return;
  }

  throw promiseRace;
};

export type DeferStatus = "pending" | "rejected" | "resolved";

export type Defer<T> = {
  readonly status: DeferStatus;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: unknown) => void;
  pause(): VoidFunction;
};

export function createDefer<T = void>() {
  let defer: Defer<T> = {
    status: "pending",
    resolve: noop as any,
    reject: noop as any,
    pause: () => noop,
  };

  const promise = new Promise<T>((resolve, reject) => {
    let status: DeferStatus = "pending";
    let realValue: any;
    let isPausing = false;
    let realStatus: DeferStatus = "pending";

    const syncStatus = () => {
      if (realStatus === "pending" || isPausing) return;
      status = realStatus;
      if (realStatus === "resolved") {
        resolve(realValue);
      } else {
        reject(realValue);
      }
    };

    defer = {
      get status() {
        return status;
      },
      resolve(value) {
        if (realStatus !== "pending") return;
        realStatus = "resolved";
        realValue = value;
        syncStatus();
      },
      reject(reason) {
        if (realStatus !== "pending") return;
        realStatus = "rejected";
        realValue = reason;
        syncStatus();
      },
      pause() {
        // do nothing if promise is resolved or rejected
        if (status !== "pending") {
          return noop;
        }
        isPausing = true;
        return () => {
          if (!isPausing) return;
          isPausing = false;
          syncStatus();
        };
      },
    };
  });

  return [promise, defer] as const;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
