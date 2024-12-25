import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ModelInstance, ModelProps, ModelType, Observable } from "../types";
import { ContainerScope, useContainer } from "./containerContext";
import { getObservableGetter, is, isObservable } from "../utils";
import { callbackGroup } from "../callbackGroup";
import { isPromiseLike } from "../async";

export type ReactiveModelInstance<T> = {
  [key in keyof T]: T[key] extends Observable<infer V> ? V : T[key];
};

export type ReactiveContainer = {
  get<T extends ModelProps>(type: ModelType<T, void>): ReactiveModelInstance<T>;
  get<T extends ModelProps, K>(
    type: ModelType<T, K>,
    key: K
  ): ReactiveModelInstance<T>;
};

type ReactiveApi = {
  readonly version: object;
  onRender(next: ReactiveApi): void;
  watch(): VoidFunction;
} & ReactiveContainer;

export type UseReactive = {
  (scope: ContainerScope): ReactiveContainer;
  <T extends ModelProps, K>(
    scope: ContainerScope,
    type: ModelType<T, K>,
    key: K
  ): ModelInstance<T>;
  <T extends ModelProps>(
    scope: ContainerScope,
    type: ModelType<T>
  ): ModelInstance<T>;

  (): ReactiveContainer;
  <T extends ModelProps, K>(type: ModelType<T, K>, key: K): ModelInstance<T>;
  <T extends ModelProps>(type: ModelType<T>): ModelInstance<T>;
};

export const useReactive: UseReactive = (...args: any[]): any => {
  let scope: ContainerScope | undefined;
  let type: ModelType<any, any> | undefined;
  let key: any;

  if (is<ContainerScope>(args[0], "string")) {
    [scope, type, key] = args;
  } else {
    [type, key] = args;
  }

  const container = useContainer(scope);
  const onChange = useState({})[1];
  const prevApiRef = useRef<ReactiveApi>();
  const renderingRef = useRef(true);
  const unmountRef = useRef(false);

  const nextApi = useMemo<ReactiveApi>(() => {
    const cache = new Map<any, any>();
    const observables = new Map<Observable<any>, any>();
    let version = {};
    let unwatch: VoidFunction | undefined;
    const rerender = () => {
      if (unmountRef.current) {
        return;
      }
      onChange({});
    };

    return {
      get version() {
        return version;
      },
      watch() {
        unwatch?.();

        let hasChange = false;
        const unsubscribe = callbackGroup();
        observables.forEach((prevValue, observable) => {
          const currentValue = getObservableGetter(observable)();
          if (currentValue !== prevValue) {
            hasChange = true;
          }
          unsubscribe(observable.subscribe(rerender));
        });

        if (hasChange) {
          rerender();
        }
        unwatch = unsubscribe.invokeAndClear;
        return unwatch;
      },
      get(type: ModelType<any, any>, key?: any) {
        const instance = container.get(type, key) as any;
        let proxy = cache.get(instance);
        if (!proxy) {
          proxy = new Proxy(
            {},
            {
              get(_, prop) {
                const propValue = instance[prop];
                // only subscribe observables while rendering
                if (isObservable(propValue) && renderingRef.current) {
                  const observableValue = getObservableGetter(propValue)();
                  if (!observables.has(propValue)) {
                    observables.set(propValue, observableValue);
                    version = {};
                  }
                  if (isPromiseLike(propValue)) {
                    return propValue;
                  }
                  // return current value of observable
                  return observableValue;
                }
                return propValue;
              },
            }
          );
          cache.set(instance, proxy);
        }
        return proxy;
      },
      onRender(next) {
        observables.clear();
        if (next === this) {
          return;
        }
        unwatch?.();
        cache.clear();
      },
    };
  }, [container, onChange]);

  renderingRef.current = true;
  unmountRef.current = false;
  prevApiRef.current?.onRender(nextApi);
  prevApiRef.current = nextApi;

  useLayoutEffect(() => {
    renderingRef.current = false;
    unmountRef.current = false;
    const unwatch = nextApi.watch();
    return () => {
      unmountRef.current = true;
      unwatch();
    };
  }, [nextApi]);

  if (type) {
    return nextApi.get(type, key);
  }

  return nextApi;
};
