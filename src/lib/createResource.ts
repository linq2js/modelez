import { convertToPromise, createDefer, setResult, waitAll } from "./async";
import { callbackGroup } from "./callbackGroup";
import { createEffect } from "./createEffect";
import { createStaticState } from "./createStaticState";
import { OBSERVABLE_CURRENT_PROP } from "./symbols";
import {
  DependencyAccessors,
  DependencyMap,
  Loadable,
  LoadableStatus,
  MutableResource,
} from "./types";
import { noop } from "./utils";

const NEVER_RESOLVED_PROMISE = new Promise<any>(noop);
const VERSION_PROP = Symbol("version");

export type ResourceData = { status: LoadableStatus; value: any };

export function createResource<T, D extends DependencyMap>(
  dependencies: D,
  loadFn: (accessors: DependencyAccessors<D>) => Promise<T>,
  initial?: { value: any }
): MutableResource<T> {
  // Notifier to notify subscribers on state changes
  const onChangeNotifier = callbackGroup<[Loadable<T>]>();

  // Initial resource state, default to 'idle' if not provided
  let current: ResourceData = { status: "idle", value: undefined };
  // eslint-disable-next-line prefer-const
  let resource: MutableResource<T>;

  // Version tracking for the resource, used to control re-execution of effects
  // 0 = idle, increment to reload the resource
  const version = createStaticState(0);

  let disposed = false;

  // Deferred promise to handle async resource loading
  let [promise, defer] = createDefer<T>();

  // Helper function to update resource state and notify subscribers
  const update = (status: LoadableStatus, value: any) => {
    if (current.status !== status || current.value !== value) {
      current = { status, value };
      onChangeNotifier.invoke(loadable); // Notify subscribers about the state change
    }

    // because resource has promise like API, we need to update promise result whenever resource loading progress changed, for making sure waitAll and waitAny work properly
    if (status === "loading") {
      setResult(resource, { status: "pending", value: undefined });
    } else if (status === "failed") {
      setResult(resource, { status: "rejected", value });
    } else if (status === "succeeded") {
      setResult(resource, { status: "resolved", value });
    }
  };

  // Loadable object providing the current state of the resource
  const loadable: Loadable<T> = {
    get error() {
      return current.status === "failed" ? current.value : undefined;
    },
    get loading(): any {
      return current.status === "loading";
    },
    get failed(): any {
      return current.status === "failed";
    },
    get value() {
      return current.status === "succeeded" ? current.value : undefined;
    },
    get status() {
      return current.status;
    },
  };

  // Cleanup function to dispose of the resource and its effects
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    version.dispose();
    disposeEffect();
    promise = NEVER_RESOLVED_PROMISE; // Replace the promise to avoid dangling resolutions
  };

  // Resource API
  resource = {
    // Internal property to expose the current loadable state
    [OBSERVABLE_CURRENT_PROP as any]() {
      return loadable;
    },
    get error() {
      return loadable.error;
    },
    get loading(): any {
      return loadable.loading;
    },
    get failed(): any {
      return loadable.failed;
    },
    get value(): any {
      return loadable.value;
    },
    get status(): any {
      return loadable.status;
    },
    // Promise-like interface for async handling
    then(onResolve, onReject) {
      return promise.then(onResolve, onReject);
    },
    // Load the resource if it hasn't been loaded yet
    load() {
      if (!version()) {
        version(1); // Initialize version to trigger the effect
      }
      return this;
    },
    // Reload the resource by incrementing the version
    reload() {
      version((x) => x + 1);
      return this;
    },
    // Dispose of the resource and its subscriptions
    dispose,
    // Subscription management for resource state changes
    subscribe: onChangeNotifier,
    pause() {
      return defer.pause();
    },
  };

  // Effect to monitor dependencies and trigger resource loading
  const disposeEffect = createEffect(
    { ...dependencies, [VERSION_PROP]: version },
    (accessors) => {
      if (disposed || !accessors[VERSION_PROP]) return;

      // Create a new deferred promise if the current one is resolved/rejected
      if (defer.status !== "pending") {
        [promise, defer] = createDefer();
      }

      const d = defer;

      // Wait for the load function to resolve or reject
      waitAll(
        [
          convertToPromise(() => {
            if (initial) {
              const initialValue = initial.value;
              initial = undefined;
              return initialValue;
            }
            return loadFn(accessors);
          }),
        ],
        ([value]) => {
          // Prevent race conditions or updates after resource is disposed
          if (disposed || d !== defer) return;
          d.resolve(value);
          update("succeeded", value);
        },
        (reason) => {
          // Prevent race conditions or updates after resource is disposed
          if (disposed || d !== defer) return;
          d.reject(reason);
          update("failed", reason);
        },
        () => {
          // Update status to 'loading' while waiting for the result
          if (disposed || d !== defer) return;
          update("loading", undefined);
        }
      );
    }
  );

  return resource;
}
