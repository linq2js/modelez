import equal from "@wry/equality";
import { ModelContainer, ModelInstance, ModelType, Storage } from "./types";
import { isLazy, isType } from "./utils";
import { createInstance } from "./createInstance";
import { createInMemoryStorage } from "./createInMemoryStorage";
import { CONTAINER_LAZY_PROP, MODEL_CONTAINER_SYMBOL } from "./symbols";
import { MapEx } from "./mapEx";

const EMPTY_LIST: any[] = [];

export type DefaultOptions = object;

export type SingleStorageOptions = { storage?: Storage; storages?: never };

export type MultipleStoragesOptions = {
  storages?: Record<string, Storage>;
  storage?: never;
};

export type ContainerOptions = DefaultOptions &
  (SingleStorageOptions | MultipleStoragesOptions);

function lazy<T>(name?: string): T {
  return { [CONTAINER_LAZY_PROP]: true, name } as any;
}

export const createContainer = Object.assign(
  (options: ContainerOptions = {}): ModelContainer => {
    type ModelInstanceEntry = { key: any; instance: ModelInstance<any> };
    type RegistryEntry =
      | { type: "model"; instances: ModelInstanceEntry[] }
      | { type: "value"; value: any };

    let registry = new Map<any, RegistryEntry>();
    const storages: Record<string, Storage> = {
      default: createInMemoryStorage(),
    };

    if ("storages" in options && options.storages) {
      Object.assign(storages, options.storages);
    } else if ("storage" in options && options.storage) {
      storages.default = options.storage;
    }

    const container: ModelContainer = {
      [MODEL_CONTAINER_SYMBOL as any]: true,
      storages: storages as any,
      get(type: any, key?: any): any {
        if (!type) {
          throw new Error("Invalid dependency");
        }

        let entry = registry.get(type);

        if (isType(type)) {
          if (!entry) {
            entry = { type: "model", instances: [] };
            registry.set(type, entry);
          }
          if (entry.type === "model") {
            const instances = entry.instances;
            const instance = instances.find((x) => equal(x.key, key));
            if (!instance) {
              const [newInstance, { init }] = createInstance(
                this,
                type,
                key,
                () => {
                  const index = instances.findIndex((x) => equal(x.key, key));
                  if (index !== -1) {
                    instances.splice(index, 1);
                  }
                },
                () => createContainer(options)
              );
              instances.push({ instance: newInstance, key });
              init();
              return newInstance;
            }

            return instance.instance;
          }
        }

        if (entry?.type === "value") {
          return entry.value;
        }

        return type;
      },

      getAll(type): any {
        const entry = registry.get(type);

        if (entry?.type === "model") {
          return entry.instances;
        }

        return EMPTY_LIST;
      },

      delete(type: any, key?: any) {
        const entry = registry.get(type);
        if (!entry) return;
        if (entry.type === "value") {
          registry.delete(type);
          return;
        }
        const index = entry.instances.findIndex((x) => equal(x.key, key));
        if (index !== -1) {
          const [instance] = entry.instances.splice(index, 1);
          instance.instance.dispose();
        }
      },

      deleteAll(type?: ModelType<any>) {
        let error: any;

        const disposeInstances = (instances: ModelInstanceEntry[]) => {
          instances.forEach((x) => {
            try {
              x.instance.dispose();
            } catch (ex) {
              error = ex;
            }
          });
        };

        if (type) {
          const entry = registry.get(type);
          if (entry?.type === "model") {
            const copyInstances = entry.instances.slice();
            entry.instances.length = 0;
            disposeInstances(copyInstances);
          }
        } else {
          registry.forEach((entry) => {
            if (entry.type === "model") {
              const copyInstances = entry.instances.slice();
              entry.instances.length = 0;
              disposeInstances(copyInstances);
            }
          });
          registry.clear();
        }

        if (error) {
          throw error;
        }
      },

      set(key, impl) {
        registry.set(key, { type: "value", value: impl });
      },

      backup() {
        const prevRegistry = registry;
        const newRegistry: typeof registry = new MapEx(registry);
        return () => {
          if (newRegistry === registry) {
            registry = prevRegistry;
          }
        };
      },

      named(dependencies) {
        Object.entries(dependencies).forEach(([key, value]) => {
          registry.set(key, { type: "value", value });
        });
        return new Proxy(
          {},
          {
            get(_, prop) {
              if (prop === "$container") {
                return container;
              }

              if (!(prop in dependencies)) {
                throw new Error(`Invalid dependency name ${prop as string}`);
              }

              const item = registry.get(prop);
              if (item?.type === "value") {
                if (isLazy(item.value)) {
                  throw new Error(
                    `The dependency ${prop as string}${
                      item.value.name ? ":" + item.value.name : ""
                    } is defined lazily, but no runtime value has been assigned yet.`
                  );
                }
                return item.value;
              }

              return undefined;
            },
            set(_, prop, value) {
              if (!(prop in dependencies)) {
                throw new Error(`Invalid dependency name ${prop as string}`);
              }

              registry.set(prop, { type: "value", value });

              return true;
            },
          }
        ) as any;
      },
    };

    return container;
  },
  { lazy }
);
