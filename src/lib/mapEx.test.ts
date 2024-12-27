import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEx } from "./mapEx";

describe("MapEx", () => {
  let map: MapEx<any, any>;

  beforeEach(() => {
    map = new MapEx();
  });

  it("should set and get non-object keys correctly", () => {
    map.set("name", "John");
    map.set(42, "Answer to the Ultimate Question");

    expect(map.get("name")).toBe("John");
    expect(map.get(42)).toBe("Answer to the Ultimate Question");
  });

  it("should set and get object keys using deep comparison", () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };

    map.set(obj1, "Object 1");
    map.set(obj2, "Object 2");

    expect(map.get(obj1)).toBe("Object 1");
    expect(map.get(obj2)).toBe("Object 2");
    expect(map.get({ id: 1 })).toBe("Object 1"); // Deep comparison
  });

  it("should correctly report size of the map", () => {
    map.set("name", "John");
    const obj1 = { id: 1 };
    map.set(obj1, "Object 1");

    expect(map.size).toBe(2);
  });

  it("should check for the presence of keys", () => {
    map.set("name", "John");
    const obj1 = { id: 1 };
    map.set(obj1, "Object 1");

    expect(map.has("name")).toBe(true);
    expect(map.has({ id: 1 })).toBe(true); // Deep comparison
    expect(map.has({ id: 2 })).toBe(false);
  });

  it("should delete non-object keys correctly", () => {
    map.set("name", "John");
    expect(map.has("name")).toBe(true);

    map.delete("name");
    expect(map.has("name")).toBe(false);
  });

  it("should delete object keys using deep comparison", () => {
    const obj1 = { id: 1 };
    map.set(obj1, "Object 1");

    expect(map.has(obj1)).toBe(true);

    map.delete({ id: 1 });
    expect(map.has(obj1)).toBe(false); // Deep comparison
  });

  it("should clear all entries", () => {
    map.set("name", "John");
    const obj1 = { id: 1 };
    map.set(obj1, "Object 1");

    map.clear();

    expect(map.size).toBe(0);
    expect(map.has("name")).toBe(false);
    expect(map.has(obj1)).toBe(false);
  });

  it("should iterate over keys, values, and entries", () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    map.set("name", "John");
    map.set(obj1, "Object 1");
    map.set(obj2, "Object 2");

    // Keys
    const keys = Array.from(map.keys());
    expect(keys).toContain("name");
    expect(keys).toContain(obj1);
    expect(keys).toContain(obj2);

    // Values
    const values = Array.from(map.values());
    expect(values).toContain("John");
    expect(values).toContain("Object 1");
    expect(values).toContain("Object 2");

    // Entries
    const entries = Array.from(map.entries());
    expect(entries).toEqual([
      ["name", "John"],
      [obj1, "Object 1"],
      [obj2, "Object 2"],
    ]);
  });

  it("should support forEach iteration", () => {
    const obj1 = { id: 1 };
    map.set("name", "John");
    map.set(obj1, "Object 1");

    const callback = vi.fn();
    map.forEach(callback);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith("John", "name", map);
    expect(callback).toHaveBeenCalledWith("Object 1", obj1, map);
  });

  it("should return undefined for missing keys", () => {
    expect(map.get("missing")).toBeUndefined();
    expect(map.get({ id: 999 })).toBeUndefined();
  });

  it("should not delete non-existent keys", () => {
    expect(map.delete("missing")).toBe(false);
    expect(map.delete({ id: 999 })).toBe(false);
  });

  it("should handle mixed keys correctly", () => {
    const obj1 = { id: 1 };
    map.set("name", "John");
    map.set(obj1, "Object 1");
    map.set(42, "Answer");

    expect(map.size).toBe(3);
    expect(map.get("name")).toBe("John");
    expect(map.get(obj1)).toBe("Object 1");
    expect(map.get(42)).toBe("Answer");
  });
});
