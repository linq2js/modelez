import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolved } from "./async";
import { createContainer } from "./createContainer";
import { createType } from "./createType";
import { ModelContainer } from "./types";

describe("createModelType", () => {
  let container: ModelContainer;

  beforeEach(() => {
    // Arrange: Initialize a new container for each test
    container = createContainer();
  });

  afterEach(() => {
    container.deleteAll();
  });

  it("should create a static state", () => {
    // Arrange: Define a model with a static state
    const type = createType("staticStateModel", ({ state }) => {
      const count = state(1); // Static state initialized to 1

      return { count };
    });

    // Act: Retrieve the model instance
    const instance = container.get(type);

    // Assert: Verify the initial state value
    expect(instance.count()).toBe(1);
  });

  it("should create a computed state", () => {
    // Arrange: Define a model with computed state and dependencies
    const type = createType("computedStateModel", ({ state }) => {
      const a = state(1);
      const b = state(2);
      const sum = state({ a, b }, (x) => x.a + x.b); // Sum computed from a and b

      return {
        sum,
        incrementA() {
          a((x) => x + 1);
        },
        incrementB() {
          b((x) => x + 1);
        },
      };
    });

    // Act: Retrieve the model instance and modify state
    const instance = container.get(type);

    // Assert: Verify initial computed value
    expect(instance.sum()).toBe(3);

    // Act: Increment state a
    instance.incrementA();

    // Assert: Verify updated computed value
    expect(instance.sum()).toBe(4);

    // Act: Increment state b
    instance.incrementB();

    // Assert: Verify final computed value
    expect(instance.sum()).toBe(5);
  });

  it("should handle a static resource", async () => {
    // Arrange: Define a model with a static resource
    const todoData = [1, 2, 3];
    const type = createType("staticResourceModel", ({ resource }) => {
      const todos = resource(Promise.resolve(todoData)); // Static resource resolves to todoData
      return { todos };
    });

    // Act: Retrieve the model instance
    const instance = container.get(type);

    // Assert: Verify loading state and resolved value
    expect(instance.todos.loading).toBeTruthy();

    const result = await instance.todos;
    expect(result).toEqual(todoData);
    expect(instance.todos.value).toEqual(todoData);
  });

  it("should reload a resource", async () => {
    // Arrange: Define a model with reloadable resource
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const type = createType("reloadResourceModel", ({ resource }) => {
      const value = resource(loader).load(); // Start loading immediately
      return {
        value,
        reload() {
          value.reload();
        },
      };
    });

    // Act: Retrieve the model instance
    const instance = container.get(type);

    // Assert: Verify initial loading state and resolved value
    expect(instance.value.loading).toBeTruthy();
    await expect(instance.value).resolves.toBe(1);
    expect(instance.value.loading).toBeFalsy();

    // Act: Reload the resource with a new value
    instance.reload();

    // Assert: Verify loading state during reload and updated value
    await Promise.resolve(); // Allow the reload process to start
    expect(instance.value.loading).toBeTruthy();
    await expect(instance.value).resolves.toBe(2);
  });

  it("should handle pre-resolved resources without loading state", async () => {
    // Arrange: Define a model with a pre-resolved resource
    const data = [1, 2, 3];
    const type = createType("preResolvedResourceModel", ({ resource }) => {
      const todos = resource(resolved(data)); // Resource is already resolved
      return { todos };
    });

    // Act: Retrieve the model instance
    const instance = container.get(type);

    // Assert: Verify no loading state and immediate resolved value
    expect(instance.todos.loading).toBeFalsy();
    expect(instance.todos.value).toEqual(data);
  });

  it("should update resource result when dependent state changes", async () => {
    const type = createType("type", ({ state, resource }) => {
      const count = state(0);
      const computedResource = resource({ count }, async (x) => {
        return `value: ${x.count}`;
      }).load();

      return {
        computedResource,
        increment() {
          count((prev) => prev + 1);
        },
        reload() {
          computedResource.reload();
        },
      };
    });

    // Act: Resolve the model and trigger state changes
    const instance = container.get(type);

    // Assert: Verify the initial resource result
    expect(instance.computedResource.loading).toBeTruthy();
    const initialResult = await instance.computedResource;
    expect(initialResult).toBe("value: 0");

    // Act: Increment the count state
    instance.increment();

    // Assert: Verify the resource result is updated after state change
    const updatedResult = await instance.computedResource;
    expect(updatedResult).toBe("value: 1");

    // Act: Increment the count state again
    instance.increment();

    // Assert: Verify the resource result is updated again
    const finalResult = await instance.computedResource;
    expect(finalResult).toBe("value: 2");

    instance.reload();
    expect(instance.computedResource.loading).toBeTruthy();
    await instance.computedResource;
    expect(instance.computedResource.value).toBe("value: 2");
  });
});
