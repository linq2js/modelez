# `modelez`

`modelez` is a lightweight, flexible, and powerful state management library for JavaScript applications. It helps you manage application state, model logic, and asynchronous resource loading with ease. Inspired by libraries like Redux and Zustand, `modelez` introduces enhancements such as:

- **Reactive model states**: Dynamically react to changes in state values.
- **Conditional reactive states**: Add conditional reactivity to your state management logic.
- **Suspense support**: Seamlessly integrate with React Suspense for async resources.
- **Multiple state storage support**: Manage states across multiple storage backends.
- **VanillaJS and React compatibility**: Works with both Vanilla JavaScript and React applications.

---

## Installation

Install `modelez` via npm:

```bash
npm install modelez
```

---

## Features

- **Reactive state management** with a simple and intuitive API.
- **Asynchronous resource handling** for seamless integration with async data sources.
- **Multi-storage support** to persist data in-memory, local storage, or custom storage.
- **Fine-grained reactivity** with the ability to subscribe to state changes.
- **React integration** with hooks like `useReactive` and `Provider`.

---

## Usage

### **Basic Example**

```ts
import { model, container } from "modelez";

// Define a counter model
const Counter = model("counter", ({ state }) => {
  const count = state(1); // Reactive state initialized to 1
  return {
    count,
    increment() {
      count((prev) => prev + 1); // Update state
    },
  };
});

// Create an application container
const app = container();

// Get the counter model instance from the container
const counter = app.get(Counter);

// Subscribe to changes in the `count` state
counter.count.subscribe((value) => {
  console.log("count state changed:", value);
});

// Interact with the model
console.log(counter.count()); // 1
counter.increment();
console.log(counter.count()); // 2
```

---

### **React Integration**

`modelez` provides a React integration to simplify state management in your components.

```tsx
import { Provider, useReactive } from "modelez/react";
import { container, model } from "modelez";

// Define a counter model
const Counter = model("counter", ({ state }) => {
  const count = state(0);
  return {
    count,
    increment() {
      count((prev) => prev + 1);
    },
  };
});

// Create an application container
const app = container();

const App = () => (
  <Provider container={app}>
    <CounterComponent />
  </Provider>
);

const CounterComponent = () => {
  const { count, increment } = useReactive(Counter);
  return <button onClick={increment}>Count: {count}</button>;
};

export default App;
```

---

## Advanced Features

### **Asynchronous Resources**

Handle asynchronous data with built-in resource loading.

```ts
const User = model("user", ({ resource }) => {
  const userDetails = resource(async () => {
    const response = await fetch("/api/user");
    return response.json();
  });

  return {
    userDetails,
    refresh() {
      userDetails.reload(); // Reload the resource
    },
  };
});

const user = app.get(User);
user.userDetails.then((data) => console.log(data));
```

### **Multiple Storage Backends**

`modelez` allows you to manage state across multiple storages, such as localStorage or in-memory storage.

```ts
const Counter = model("counter", ({ state }) => {
  const persistentCount = state("local:count", 0);
  const countFromUrl = state("url:count", 1);
  const countFromSession = state("session:count", 2);

  return {
    persistentCount,
    increment() {
      persistentCount((prev) => prev + 1);
    },
  };
});

// Set up multiple storages
const storages = {
  local: new Map(),
  // we also might store state in URLs
  url: createURLStorage(),
  // or sessionStorage
  session: {
    has(key) {
      return !!sessionStorage.getItem(key);
    },
    get(key) {
      return JSON.parse(sessionStorage.getItem(key));
    },
    set(key, value) {
      sessionStorage.setItem(key, JSON.stringify(value));
    },
  },
};

const app = container({ storages });
const counter = app.get(Counter);
counter.increment();
console.log(storages.local.get("counter/count")); // Persisted state
```

---

---

## API Documentation

### `model(name: string, factory: Function)`

Defines a model with reactive state and logic.

- `name`: A unique identifier for the model.
- `factory`: A function returning the model logic and reactive states.

### `container(options?: CreateContainerOptions)`

Creates a container to manage and resolve models.

- `options.storages`: Optional configuration for multiple storage backends. By default, container will create In-Memory storage
- `options.storage`: Optional configuration for single storage backends. By default, container will create In-Memory storage

### React Integration

- **`Provider`**: Provides a container to React components.
- **`useReactive(model: Model)`**: A React hook to use a model's reactive states and methods.

---

## Why `modelez`?

`modelez` bridges the gap between simplicity and flexibility in state management. It offers features that enhance the development experience while maintaining a lightweight footprint. Whether you're building a simple app or a complex system, `modelez` adapts to your needs.

Enjoy effortless state management with `modelez`! 🚀
