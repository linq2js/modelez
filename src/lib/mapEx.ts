import { equal } from "@wry/equality";

export class MapEx<K, V> implements Map<K, V> {
  private nonObjectMap: Map<K, V>; // To store non-object keys
  private objectEntries: Array<{ key: K; value: V }>; // To store object keys

  constructor(entries?: Map<K, V> | readonly (readonly [K, V])[] | null) {
    this.nonObjectMap = new Map();
    this.objectEntries = [];

    // If entries are provided, initialize the map
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  [Symbol.toStringTag] = "MapEx";

  // Map Methods

  set(key: K, value: V): this {
    if (this.isObjectKey(key)) {
      // For object keys, find an existing match or add a new entry
      const existingEntry = this.objectEntries.find((entry) =>
        equal(entry.key, key)
      );
      if (existingEntry) {
        existingEntry.value = value; // Update the value for existing key
      } else {
        this.objectEntries.push({ key, value }); // Add a new entry
      }
    } else {
      // For non-object keys, use the Map
      this.nonObjectMap.set(key, value);
    }
    return this;
  }

  get(key: K): V | undefined {
    if (this.isObjectKey(key)) {
      // For object keys, find the matching entry
      const entry = this.objectEntries.find((entry) => equal(entry.key, key));
      return entry?.value;
    } else {
      // For non-object keys, use the Map
      return this.nonObjectMap.get(key);
    }
  }

  has(key: K): boolean {
    if (this.isObjectKey(key)) {
      // Check in the objectEntries array
      return this.objectEntries.some((entry) => equal(entry.key, key));
    } else {
      // Check in the Map
      return this.nonObjectMap.has(key);
    }
  }

  delete(key: K): boolean {
    if (this.isObjectKey(key)) {
      // Remove the matching entry from objectEntries
      const index = this.objectEntries.findIndex((entry) =>
        equal(entry.key, key)
      );
      if (index !== -1) {
        this.objectEntries.splice(index, 1);
        return true;
      }
      return false;
    } else {
      // Delete from the Map
      return this.nonObjectMap.delete(key);
    }
  }

  clear(): void {
    this.nonObjectMap.clear();
    this.objectEntries = [];
  }

  get size(): number {
    return this.nonObjectMap.size + this.objectEntries.length;
  }

  keys(): IterableIterator<K> {
    return this.iterateKeys();
  }

  values(): IterableIterator<V> {
    return this.iterateValues();
  }

  entries(): IterableIterator<[K, V]> {
    return this.iterateEntries();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  forEach(
    callback: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: any
  ): void {
    // Process non-object keys
    this.nonObjectMap.forEach((value, key) => {
      callback.call(thisArg, value, key, this);
    });

    // Process object keys
    this.objectEntries.forEach(({ key, value }) => {
      callback.call(thisArg, value, key, this);
    });
  }

  // Private Helpers

  private isObjectKey(key: K): boolean {
    return typeof key === "object" && key !== null;
  }

  private *iterateKeys(): IterableIterator<K> {
    yield* this.nonObjectMap.keys();
    for (const { key } of this.objectEntries) {
      yield key;
    }
  }

  private *iterateValues(): IterableIterator<V> {
    yield* this.nonObjectMap.values();
    for (const { value } of this.objectEntries) {
      yield value;
    }
  }

  private *iterateEntries(): IterableIterator<[K, V]> {
    yield* this.nonObjectMap.entries();
    for (const { key, value } of this.objectEntries) {
      yield [key, value];
    }
  }
}
