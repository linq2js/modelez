import { describe, expect, it, vi } from "vitest";
import {
  waitAll,
  waitAny,
  isPromiseLike,
  resolved,
  rejected,
  createDefer,
} from "./async";

describe("waitAll", () => {
  it("should resolve all promises and return resolved values", async () => {
    const promises = [resolved(1), resolved(2), resolved(3)];
    const result = waitAll(promises);
    expect(result).toEqual([1, 2, 3]);
  });

  it("should reject if any promise is rejected", async () => {
    const promises = [resolved(1), rejected(new Error("fail")), resolved(3)];
    expect(() => waitAll(promises)).toThrowError("fail");
  });

  it("should handle pending promises correctly", async () => {
    const promises = [
      resolved(1),
      new Promise((resolve) => setTimeout(() => resolve(2), 100)),
    ];

    expect(() => waitAll(promises)).toThrow();
    const result = await Promise.all(promises);
    expect(result).toEqual([1, 2]);
  });

  it("should call onResolved callback when all promises resolve", async () => {
    const promises = [resolved(1), resolved(2)];
    const onResolved = vi.fn();
    waitAll(promises, onResolved);

    expect(onResolved).toHaveBeenCalledWith([1, 2]);
  });

  it("should call onRejected callback when a promise rejects", async () => {
    const promises = [resolved(1), rejected(new Error("fail"))];
    const onResolved = vi.fn();
    const onRejected = vi.fn();
    waitAll(promises, onResolved, onRejected);

    expect(onRejected).toHaveBeenCalledWith(expect.any(Error));
    expect(onResolved).not.toHaveBeenCalled();
  });
});

describe("waitAny", () => {
  it("should resolve as soon as any promise resolves", async () => {
    const promises = {
      a: new Promise((resolve) => setTimeout(() => resolve(1), 100)),
      b: resolved(2),
      c: new Promise((resolve) => setTimeout(() => resolve(3), 200)),
    };
    const result = waitAny(promises);
    expect(result).toEqual({ b: 2 });
  });

  it("should reject if any promise rejects first", async () => {
    const promises = {
      a: rejected("fail"),
      b: resolved(2),
    };

    expect(() => waitAny(promises)).toThrowError("fail");
  });

  it("should handle onResolved callback correctly", async () => {
    const promises = {
      a: resolved(1),
      b: resolved(2),
    };
    const onResolved = vi.fn();
    waitAny(promises, onResolved);

    expect(onResolved).toHaveBeenCalledWith({ a: 1 });
  });

  it("should handle onRejected callback correctly", async () => {
    const promises = {
      a: rejected(new Error("fail")),
      b: resolved(2),
    };
    const onResolved = vi.fn();
    const onRejected = vi.fn();
    waitAny(promises, onResolved, onRejected);

    expect(onRejected).toHaveBeenCalledWith(expect.any(Error));
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("should return pending promise when no promises are resolved yet", async () => {
    const promises = {
      a: new Promise((resolve) => setTimeout(() => resolve(1), 200)),
      b: new Promise((resolve) => setTimeout(() => resolve(2), 300)),
    };

    expect(() => waitAny(promises)).toThrow();
    const result = await Promise.race(Object.values(promises));
    expect(result).toBe(1);
  });
});

describe("Utility Functions", () => {
  it("should identify promise-like values", () => {
    expect(isPromiseLike(resolved(42))).toBe(true);
    expect(isPromiseLike({ then: () => {} })).toBe(true);
    expect(isPromiseLike({})).toBe(false);
    expect(isPromiseLike(null)).toBe(false);
  });
});

describe("createDefer", () => {
  it("should not resolve promise if defer is pausing", async () => {
    const resolved = vi.fn();
    const rejected = vi.fn();
    const [promise, defer] = createDefer();
    promise.then(resolved, rejected);
    const unpause = defer.pause();
    defer.resolve();
    expect(defer.status).toBe("pending");
    expect(resolved).not.toBeCalled();
    unpause();
    await promise;
    expect(defer.status).toBe("resolved");
    expect(resolved).toBeCalled();
  });
});
