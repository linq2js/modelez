import { isPromiseLike } from './async';
import { callbackGroup } from './callbackGroup';
import { createComputedState } from './createComputedState';
import { createEffect, createWatcher } from './createEffect';
import { createResource } from './createResource';
import { createStaticState } from './createStaticState';
import { MODEL_INSTANCE_SYMBOL } from './symbols';
import {
  AnyFunc,
  ModelContext,
  ModelContainer,
  ModelInstance,
  ModelType,
  MutableResource,
  MutableState,
} from './types';
import { isType, lazy, noop } from './utils';

const UNDEFINED_GETTER = () => undefined; // Placeholder for undefined properties
const NORMAL_FUNC_PROP_COUNT = Object.getOwnPropertyDescriptors(
  () => {}
).length; // Number of properties in a normal function

export type ModelLifecycle = 'pre-init' | 'init' | 'ready' | 'disposed';

/**
 * Creates an instance of a model, manages its lifecycle, state, and resources.
 *
 * @param container - The model container managing state and resources.
 * @param type - The model type defining the instance behavior.
 * @param key - A unique key to identify and cache model instances.
 * @param onDispose - A callback executed when the model instance is disposed.
 * @returns A tuple containing the model instance and its API (init, cleanup).
 */
export function createInstance(
  container: ModelContainer,
  type: ModelType<any>,
  key: any,
  onDispose: VoidFunction,
  createChildContainer: () => ModelContainer
) {
  /** Manages cleanup callbacks such as effects, resources, and subscriptions */
  const disposeNotifier = callbackGroup();

  /** Manages initialization callbacks */
  const initNotifier = callbackGroup();
  const childContainer = lazy(createChildContainer, (x) => x.deleteAll());
  let phase: ModelLifecycle = 'pre-init';

  const getStorageAccessor = (key: string) => {
    const parts = key.split(':');
    const [storageName, storageKey] =
      parts.length > 1 ? [parts[0], parts[1]] : ['default', parts[0]];
    if (storageName in container.storages) {
      const fullStorageKey = `${type.name}/${storageKey}`;

      const storage = container.storages[storageName];
      return {
        exist() {
          return storage.has(fullStorageKey);
        },
        get() {
          return storage.get(fullStorageKey);
        },
        set(value: any) {
          storage.set(fullStorageKey, value);
        },
      };
    }

    throw new Error(`No storage named '${storageName}' found`);
  };

  /**
   * Context provided to the model builder for managing its state, resources, and effects.
   */
  const context: ModelContext = {
    ...container,

    /**
     * Creates an effect that listens to changes in dependencies and runs a callback.
     * The effect automatically disposes when the model instance is disposed.
     *
     * @param dependencies - A map of observables or other reactive values.
     * @param effectFn - The function to execute when dependencies change.
     * @returns A cleanup function for the effect.
     */
    effect(...args) {
      const disposeEffect = createEffect(...args);
      disposeNotifier(disposeEffect);
      return disposeEffect;
    },

    watch(...args) {
      const disposeWatcher = createWatcher(...args);
      disposeNotifier(disposeWatcher);
      return disposeWatcher;
    },

    /**
     * Creates a resource, optionally persisting it to storage and reloading it when necessary.
     *
     * @param args - Overloaded arguments:
     *   - `resource(key, loadFn)`: Persisted resource.
     *   - `resource(promise)` or `resource(loadFn)`: In-memory resource.
     * @returns A mutable resource object.
     */
    resource(...args: any[]) {
      if (phase !== 'pre-init') {
        throw new Error(
          'The resource can be initialized during the pre-init phase'
        );
      }

      let resource: MutableResource<any>;
      let initial: { value: any } | undefined;
      let autoLoad = false;

      // Handle persisted resource
      if (typeof args[0] === 'string') {
        const storageAccessor = getStorageAccessor(args[0] as string);

        // Load initial value from storage if available
        if (storageAccessor.exist()) {
          initial = {
            value: storageAccessor.get(),
          };
        }

        if (typeof args[2] === 'function') {
          resource = createResource(args[1], args[2], initial);
        } else {
          resource = createResource({}, args[1], initial);
        }

        // Persist changes back to storage when resource is updated
        resource.subscribe((loadable) => {
          if (loadable.status === 'succeeded') {
            storageAccessor.set(loadable.value);
          }
        });
      } else {
        // Handle in-memory resource
        let loadFn: AnyFunc;
        let dependencies = {};

        if (isPromiseLike(args[0])) {
          const promise = args[0];
          autoLoad = true;
          loadFn = () => promise;
        } else if (typeof args[0] === 'function') {
          loadFn = args[0];
        } else {
          [dependencies, loadFn] = args;
        }

        resource = createResource(dependencies, loadFn);
      }

      disposeNotifier(resource.dispose);

      if (autoLoad) {
        resource.load();
      }

      return resource;
    },

    /**
     * Creates a state that can be either in-memory or persisted.
     *
     * @param args - Overloaded arguments:
     *   - `state(name, initialValue)`: Creates persisted state.
     *   - `state(dependencies, computeFn)`: Creates computed state.
     *   - `state(initialValue)`: Creates static state.
     * @returns A mutable state object.
     */
    state(...args: any[]) {
      if (phase !== 'pre-init') {
        throw new Error(
          'The state can be initialized during the pre-init phase'
        );
      }
      let state: MutableState<any>;

      if (typeof args[0] === 'string' && args.length > 1) {
        const [storageKey, initialValue] = args;
        const storageAccessor = getStorageAccessor(storageKey);
        const persistedValue = storageAccessor.exist()
          ? storageAccessor.get()
          : initialValue;

        state = createStaticState(persistedValue);
        state.subscribe((nextValue) => {
          storageAccessor.set(nextValue);
        });
      } else if (typeof args[1] === 'function') {
        const [dependencies, computeFn] = args;
        state = createComputedState(dependencies, computeFn);
      } else {
        state = createStaticState(args[0]);
      }

      disposeNotifier(state.dispose);

      return state;
    },

    /**
     * Registers an event listener for `init` or `dispose` events.
     *
     * @param event - The event name (`init` or `dispose`).
     * @param listener - The callback to execute when the event occurs.
     */
    on(event, listener): any {
      if (event === 'init') {
        return initNotifier(listener);
      }
      if (event === 'dispose') {
        return disposeNotifier(listener);
      }
      return noop;
    },

    use(target: any, ...args: any[]): any {
      // create instance from type
      if (isType(target)) {
        return childContainer.value.get(target, args[0]);
      }

      // is logic loading
      if (isPromiseLike(target)) {
        let loadedFn: AnyFunc | undefined;
        return async (...args: any[]) => {
          if (!loadedFn) {
            const result: any = await target;
            const init: AnyFunc | undefined = result?.default;
            loadedFn = init?.(context);
          }

          return loadedFn?.(...args);
        };
      }
      return target(context, ...args);
    },
  };

  /**
   * Disposes of the model instance and its resources.
   */
  const dispose = () => {
    if (phase === 'disposed') return;
    phase = 'disposed';
    childContainer.dispose();
    onDispose();
    disposeNotifier.invokeAndClear();
  };

  const getters = new Map<string, () => any>();

  // Proxy to handle model property access dynamically
  const instance = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === MODEL_INSTANCE_SYMBOL) return true;
        if (typeof prop !== 'string') return undefined;
        if (prop === 'init') return undefined;
        if (prop === 'dispose') return dispose;

        let getter = getters.get(prop);

        if (!getter) {
          const descriptor = descriptors[prop];
          if (!descriptor) {
            getters.set(prop, UNDEFINED_GETTER);
            return UNDEFINED_GETTER();
          }

          if (descriptor.get) {
            getter = () => descriptor.get?.call(instance);
          } else if (
            typeof descriptor.value === 'function' &&
            Object.getOwnPropertyDescriptors(descriptor.value).length ===
              NORMAL_FUNC_PROP_COUNT
          ) {
            const fn = descriptor.value as AnyFunc;
            const wrapper = (...args: any[]) => fn.call(instance, ...args);
            getter = () => wrapper;
          } else {
            getter = () => descriptor.value;
          }

          getters.set(prop, getter);
        }

        return getter();
      },
      ownKeys(_) {
        // Return an array of all enumerable property keys
        return keys;
      },

      getOwnPropertyDescriptor(_, prop) {
        // Ensure the property is treated as enumerable
        return {
          configurable: true,
          enumerable: true,
          value: instance[prop as any],
          writable: false,
        };
      },
    }
  ) as ModelInstance<any>;

  const originalProps = type.builder(context, key);
  phase = 'init';
  const keys = Object.keys(originalProps).concat('dispose');
  const descriptors = Object.getOwnPropertyDescriptors(originalProps);

  return [
    instance,
    {
      /**
       * Initializes the model instance.
       */
      init() {
        initNotifier.invokeAndClear();
        phase = 'ready';
      },

      /**
       * Cleans up resources and events registered in the model.
       */
      cleanup() {
        initNotifier.clear();
        disposeNotifier.clear();
      },
    },
  ] as const;
}
