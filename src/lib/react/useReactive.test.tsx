import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createContainer } from "../createContainer";
import { ModelContainer } from "../types";
import { PropsWithChildren, Suspense } from "react";
import { Provider } from "./containerContext";
import { createType } from "../createType";
import { useReactive } from "./useReactive";
import { delay, waitAll } from "../async";
import React from "react";

describe("useReactive", () => {
  let container: ModelContainer;
  let loading: Mock;

  const Person = createType("person", () => {
    return {
      id: Math.random(),
    };
  });

  const Counter = createType("counter", ({ state }) => {
    const count = state(0);
    return {
      count,
      increment() {
        count((x) => x + 1);
      },
    };
  });

  const Database = createType("database", ({ resource }) => {
    const database = resource(() => Promise.resolve(100)).load();

    return {
      database,
      reload() {
        database.reload();
      },
    };
  });

  beforeEach(() => {
    container = createContainer();
    loading = vi.fn();
  });

  afterEach(() => container.deleteAll());

  const Fallback = () => {
    loading();
    return null;
  };

  const wrapper = ({ children }: PropsWithChildren) => {
    return (
      <Provider container={container}>
        <Suspense fallback={<Fallback />}>{children}</Suspense>
      </Provider>
    );
  };

  it("should use global container if scope = global. Overload #1", () => {
    const useHook = () => {
      return useReactive("global").get(Person).id;
    };

    const { result } = renderHook(useHook, { wrapper });

    expect(result.current).toBe(container.get(Person).id);
  });

  it("should use global container if scope = global. Overload #2", () => {
    const useHook = () => {
      return useReactive().get(Person).id;
    };

    const { result } = renderHook(useHook, { wrapper });

    expect(result.current).toBe(container.get(Person).id);
  });

  it("should use local container if scope = local", () => {
    const useHook = () => {
      return useReactive("local").get(Person).id;
    };

    const { result } = renderHook(useHook, { wrapper });

    expect(result.current).not.toBe(container.get(Person).id);
  });

  it("should re-render if reactive state changed", () => {
    const log = vi.fn();
    const useHook = () => {
      log();
      // extract props to make state reactively
      const { count, increment } = useReactive().get(Counter);
      return { count, increment };
    };
    const { result, rerender } = renderHook(useHook, { wrapper });

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);

    expect(log).toBeCalledTimes(2);

    rerender();

    expect(log).toBeCalledTimes(3);

    act(() => {
      // dispatch action outside component
      container.get(Counter).increment();
    });

    expect(result.current.count).toBe(2);

    expect(log).toBeCalledTimes(4);
  });

  it("should not re-render if the component does not consume reactive state", () => {
    const log = vi.fn();
    const useHook = () => {
      log();
      // retrieve counter obj but not consume any prop
      useReactive().get(Counter);
    };
    renderHook(useHook, { wrapper });

    act(() => {
      // dispatch action outside component
      container.get(Counter).increment();
    });

    // no re-render
    expect(log).toBeCalledTimes(1);
  });

  it("should handle resource loading properly", async () => {
    const useHook = () => {
      const { database } = useReactive(Database);
      const [data] = waitAll([database]);
      return data;
    };
    const { result, rerender } = renderHook(useHook, { wrapper });
    expect(loading).toBeCalledTimes(1);
    await act(() => delay(10));
    expect(result.current).toBe(100);
    rerender();
    // when re-render if the data is already loaded, no loading effect
    expect(loading).toBeCalledTimes(1);
    act(() => {
      container.get(Database).reload();
    });
    expect(loading).toBeCalledTimes(2);
    await act(() => delay(10));
    expect(result.current).toBe(100);
  });
});
