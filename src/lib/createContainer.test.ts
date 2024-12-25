import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContainer } from "./createContainer";
import { createInMemoryStorage } from "./createInMemoryStorage";
import { createType } from "./createType";
import { ModelContainer } from "./types";
import { isModel } from "./utils";

describe("createContainer", () => {
  let container: ModelContainer;
  let storage: Map<string, any>;

  beforeEach(() => {
    storage = new Map();
    container = createContainer({ storage });
  });

  afterEach(() => {
    container.deleteAll();
  });

  it("should create a container with default in-memory storage", () => {
    // Assert: Verify storage is initialized
    expect(container.storages.default).toBeDefined();
  });

  it("should resolve a simple dependency", () => {
    const dependency = { foo: "bar" };
    container.set(dependency, dependency);

    // Act: Resolve the dependency
    const resolved = container.get(dependency);

    // Assert: Verify the resolved dependency matches the original
    expect(resolved).toBe(dependency);
  });

  it("should resolve and instantiate a model using createModelType", () => {
    const counterModel = createType("Counter", (context) => {
      const count = context.state(0);
      return {
        count,
        increment() {
          count((x) => x + 1);
        },
      };
    });

    // Act: Retrieve the model instance and invoke increment
    const instance = container.get(counterModel);
    // Assert: Verify the initial and updated state
    expect(instance.count()).toBe(0);
    instance.increment();
    expect(instance.count()).toBe(1);
  });

  it("should return the same model instance for the same type and key", () => {
    const TestModel = createType("TestModel", (_context, _key: string) => {
      return { id: Math.random() };
    });

    // Act: Resolve the same model type with the same key
    const instance1 = container.get(TestModel, "key1");
    const instance2 = container.get(TestModel, "key1");

    // Assert: Verify both instances are the same
    expect(instance1).toBe(instance2);
  });

  it("should return different model instances for the same type but different keys", () => {
    const TestModel = createType("TestModel", (_, _key: string) => {
      return { id: Math.random() };
    });

    // Act: Resolve the model type with different keys
    const instance1 = container.get(TestModel, "key1");
    const instance2 = container.get(TestModel, "key2");

    // Assert: Verify instances are different
    expect(instance1).not.toBe(instance2);
  });

  it("should dispose a specific model instance by key", () => {
    const dispose = vi.fn();
    const TestModel = createType("DisposableModel", ({ on }, _key: string) => {
      on("dispose", dispose);
      return {};
    });

    // Act: Retrieve and delete the model instance
    container.get(TestModel, "key1");
    container.delete(TestModel, "key1");

    // Assert: Verify the dispose method was called
    expect(dispose).toHaveBeenCalled();
  });

  it("should dispose all model instances of a specific type", () => {
    const dispose = vi.fn();
    const TestModel = createType("TestModel", ({ on }, _key: string) => {
      on("dispose", dispose);
      return {};
    });

    // Act: Resolve multiple instances of the same type and delete them all
    container.get(TestModel, "key1");
    container.get(TestModel, "key2");
    container.deleteAll(TestModel);

    // Assert: Verify all instances were disposed
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(container.getAll(TestModel)).toEqual([]);
  });

  it("should remove model instance from container when model.dispose is invoked", () => {
    const modelType = createType("TestModel1", () => ({}));

    // Act: Retrieve and dispose the model instance
    const instance = container.get(modelType);
    instance.dispose();

    // Assert: Verify the model is removed from the container
    expect(container.getAll(modelType)).toEqual([]);
  });

  it("should dispose all model instances in the container", () => {
    const dispose = vi.fn();

    const TestModel1 = createType("TestModel1", ({ on }) => {
      on("dispose", dispose);

      return {};
    });

    const TestModel2 = createType("TestModel2", ({ on }) => {
      on("dispose", dispose);
      return {};
    });

    // Act: Resolve the models and delete all instances
    container.get(TestModel1);
    container.get(TestModel2);
    container.deleteAll();

    // Assert: Verify all instances were disposed
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(container.getAll(TestModel1)).toEqual([]);
    expect(container.getAll(TestModel2)).toEqual([]);
  });

  it("should throw an error when resolving an invalid dependency", () => {
    // Act and Assert: Attempting to resolve an invalid dependency throws an error
    expect(() => {
      container.get(undefined as any);
    }).toThrowError("Invalid dependency");
  });

  it("should resolve a non-registered dependency as itself", () => {
    // Act and Assert: Resolving a non-registered dependency does not throw an error
    expect(() => {
      container.get("nonRegisteredDependency" as any);
    }).not.toThrow();
  });

  it("should handle lifecycle hooks of models correctly", () => {
    const init = vi.fn();
    const dispose = vi.fn();

    const TestModel = createType("TestModelWithLifecycle", ({ on }) => {
      on("init", init);
      on("dispose", dispose);
      return {};
    });

    // Act: Resolve and delete the model instance
    const instance = container.get(TestModel);
    container.delete(TestModel);

    // Assert: Verify lifecycle hooks are called
    expect(init).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
    expect(() => instance.dispose()).not.toThrow();
  });

  it("should support Object.keys", () => {
    const Dog = createType("dog", () => {
      return {
        name: "pluto",
        age: 10,
      };
    });

    const dog = container.get(Dog);

    // no return symbols
    expect(Object.keys(dog)).toEqual(["name", "age", "dispose"]);
    const copy = { ...dog };

    copy.dispose();

    expect(isModel(copy)).toBeFalsy();
  });

  it("should resolve model instance locally", () => {
    const Animal = createType("animal", (_, name: string) => {
      return {
        id: Math.random(),
        name,
        eat() {
          return "eat";
        },
      };
    });
    const FourLegs = createType("fourLegs", () => {
      return {
        legs() {
          return 4;
        },
      };
    });

    const Cat = createType("cat", ({ use }, name: string) => {
      const parentAnimal = use(Animal, name);
      const parentFourLegs = use(FourLegs);

      return {
        ...parentAnimal,
        ...parentFourLegs,
        legs() {
          return 4;
        },
        run() {
          return "run";
        },
      };
    });

    const animal = container.get(Animal, "a");
    const cat = container.get(Cat, "b");

    expect(animal.id).not.toBe(cat.id);
    expect(animal.name).toBe("a");
    expect(cat.name).toBe("b");
    expect(cat.eat()).toBe("eat");
    expect(cat.legs()).toBe(4);
    expect(cat.run()).toBe("run");
  });

  it("should support lazy logic", async () => {
    const type = createType("type", ({ use }) => {
      const sum = use(import("./lazyLogic"));

      return {
        result() {
          return sum(1, 2);
        },
      };
    });

    const instance = container.get(type);
    await expect(instance.result()).resolves.toBe(3);
  });

  it("should save/load persisted state from storage for state", () => {
    const storageKey = "counter/count";
    storage.set(storageKey, 2);
    const PersistedCounter = createType("counter", ({ state }) => {
      const count = state("count", 1);

      return {
        get count() {
          return count();
        },
        increment() {
          count((x) => x + 1);
        },
      };
    });
    const instance = container.get(PersistedCounter);
    expect(instance.count).toBe(2);
    instance.increment();
    expect(storage.get(storageKey)).toBe(3);
  });

  it("should save/load persisted state from storage for resource", async () => {
    const storageKey = "counter/count";
    storage.set(storageKey, 2);
    const PersistedCounter = createType("counter", ({ resource }) => {
      const count = resource("count", async () => 1).load();

      return {
        count,
        reload() {
          count.reload();
        },
      };
    });
    const instance = container.get(PersistedCounter);
    await expect(instance.count).resolves.toBe(2);
    instance.reload();
    await expect(instance.count).resolves.toBe(1);
    expect(storage.get(storageKey)).toBe(1);
  });

  it("should support multiple storages", () => {
    const storages = {
      s1: createInMemoryStorage(),
      s2: createInMemoryStorage(),
    };
    container = createContainer({ storages });
    const Counter = createType("counter", ({ state }) => {
      const c1 = state("s1:count", 0);
      const c2 = state("s2:count", 1);

      return {
        increment() {
          c1((x) => x + 1);
          c2((x) => x + 1);
        },
      };
    });

    const instance = container.get(Counter);
    instance.increment();
    expect(storages.s1.get("counter/count")).toBe(1);
    expect(storages.s2.get("counter/count")).toBe(2);
  });
});

describe("named container", () => {
  const named = createContainer().named({
    p1: 1,
    p2(): boolean {
      return true;
    },
    p3: createContainer.lazy<string>(),
  });

  afterEach(named.$container.backup());

  it("should resolve dependency by name", () => {
    expect(named.p1).toBe(1);
    expect(named.p2()).toBe(true);
  });

  it("should support updating dependency by assigning prop", () => {
    expect(named.p2()).toBe(true);
    named.p2 = () => false;
    expect(named.p2()).toBe(false);
  });

  it("should throw error if lazy dependency is not assigned yet", () => {
    expect(() => named.p3).toThrow();
    named.p3 = "test";
    expect(named.p3).toBe("test");
  });
});
