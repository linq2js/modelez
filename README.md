# Modelez

**Modelez** is a lightweight and powerful reactive state management library for **Vanilla JavaScript** and **React**. It provides an elegant and efficient way to manage application state, logic, and asynchronous resources. Modelez supports dynamic reactivity, conditional reactive states, multiple storages, and seamless integration with React.

---

## Features

- 🔄 **Reactive State**: Define and subscribe to reactive states with ease.
- ⚡ **Async Resource Management**: Handle async logic with built-in support for promises and Suspense.
- 🔃 **Conditional Reactivity**: Fine-tuned control over reactive updates.
- 🛠️ **Multiple Storages**: Manage state across multiple storage backends.
- 🧩 **VanillaJS and React Support**: Use Modelez with plain JavaScript or integrate seamlessly into React.

---

## Installation

Install Modelez via npm:

```bash
npm install modelez
```

via yarn:

```bash
yarn add modelez
```

---

## Basic Usage

### **Vanilla JavaScript**

Modelez provides reactive state management for Vanilla JavaScript applications.

```ts
import { model, container, effect } from "modelez";

// Set up the HTML structure
document.body.innerHTML = `<button id="clickMe"></button>`;

// Create a container to manage all models
const app = container();

// Define a Counter model
const CounterModel = model("counter", ({ state }) => {
  const count = state(0);

  return {
    count,
    increment() {
      count((prev) => prev + 1);
    },
  };
});

const counter = app.get(CounterModel);
const button = document.getElementById("clickMe");

// Create an effect to reactively update the button text
effect({ count: counter.count }, (deps) => {
  button.textContent = `Count: ${deps.count}`;
});

// increase counter when button clicked
button.addEventListener("click", () => {
  counter.increment();
});
```

---

### **React Integration**

Modelez integrates seamlessly with React through hooks and providers.

```tsx
import { useReactive, Provider } from "modelez/react";
import { app } from "./app";
import { CounterModel } from "./counterModel";

// Counter component
export const Counter = () => {
  const { count, increment } = useReactive(CounterModel);

  return <button onClick={increment}>Count: {count}</button>;
};

export const App = () => {
  return (
    <Provider container={app}>
      <Counter />
    </Provider>
  );
};
```

---

## Advanced Usage

### Using Multiple Storages

```tsx
import { container, model, createInMemoryStorage } from "modelez";

const getUrlParams = () => new URLSearchParams(window.location.search);

// create URL state storage
const urlStateStorage = {
  get(key) {
    const urlParams = getUrlParams();
    return urlParams.get(key);
  },
  set(key, value) {
    const urlParams = getUrlParams();
    urlParams.set(key, value);
    // Update the URL without reloading the page
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({}, "", newUrl);
  },
  has(key) {
    return getUrlParams().has(key);
  },
};

// Define storages
const inMemoryStorage = createInMemoryStorage();
const storages = {
  default: inMemoryStorage, // Default storage
  url: urlStateStorage, // URL-based storage
};

// Create a container with multiple storages
const app = container({ storages });

// Define a model with states stored in different storages
const AppModel = model("app", ({ state }) => {
  // State stored in default (in-memory) storage
  const localState = state("localCount", 0);

  // State stored in URL storage
  const urlState = state("url:page", "home");

  return {
    localState,
    urlState,
    incrementLocal() {
      localState((prev) => prev + 1);
    },
    setPage(page) {
      urlState(page);
    },
  };
});

// Access and use the model
const appModel = app.get(AppModel);

// Update and log the states
appModel.incrementLocal();
console.log("Local State:", appModel.localState());

appModel.setPage("about");
console.log("URL State (Page):", appModel.urlState());
```

### **Async Resource Management**

Modelez makes it simple to handle asynchronous data fetching.

#### Defining a Resource

```ts
import { model } from "modelez";

const BlogListModel = model("blogList", ({ resource }) => {
  const posts = resource(() => fetch("/api/posts").then((res) => res.json()));

  return {
    posts,
    async reload() {
      await posts.reload();
    },
  };
});
```

#### Using the Resource in React

```tsx
import { useReactive } from "modelez/react";

const BlogListWithLoadingIndicator = () => {
  const { posts } = useReactive(BlogListModel);

  if (posts.loading) {
    return <LoadingIndicator />;
  }

  if (posts.error) {
    return <Error error={posts.error} />;
  }

  return (
    <ul>
      {posts.value.map((post) => (
        <BlogPost key={post.id} post={post} />
      ))}
    </ul>
  );
};
```

#### Promise-Like Resources Outside React

The `resource` object implements the `PromiseLike` interface, allowing you to use `.then()` for direct access.

```ts
const blogList = app.get(BlogListModel);

blogList.posts.then((posts) => {
  console.log(posts);
});
```

---

### **Using Suspense for Async Resources**

```tsx
import { Suspense } from "react";
import { useReactive } from "modelez/react";

const BlogList = () => {
  const { posts } = useReactive(BlogListModel);

  return (
    <ul>
      {posts.value.map((post) => (
        <BlogPost key={post.id} post={post} />
      ))}
    </ul>
  );
};

const BlogListWithSuspense = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingIndicator />}>
        <BlogList />
      </Suspense>
    </ErrorBoundary>
  );
};
```

### Dependency Injection with Container

```ts
import { container } from "modelez";
import { useExternalHook } from "./externalHook";
import { ExternalComponent } from "./externalComponent";

// Create a named container for dependency injection
export const dependencies = container().named({
  ExternalComponent,
  useExternalHook,
});

export const MyComp = () => {
  const result = dependencies.useExternalHook(); // Use the injected hook

  if (result) {
    return <dependencies.ExternalComponent />; // Render the injected component
  }

  return null;
};
```

#### Unit Testing Example

```tsx
import { dependencies, MyComp } from "./myComp";
import { render } from "@testing-library/react";

describe("MyComp", () => {
  let restore: VoidFunction;

  beforeEach(() => {
    // Backup the current dependencies before mocking
    restore = dependencies.$container.backup();
  });

  afterEach(() => {
    // Restore the original dependencies after each test
    restore?.();
  });

  it("should render ExternalComponent if result = true", () => {
    // Mocking useExternalHook to return true
    dependencies.useExternalHook = () => true;

    // Mocking ExternalComponent to render a simple div
    dependencies.ExternalComponent = () => <div>ok</div>;

    // Render the component
    const { getByText } = render(<MyComp />);

    // Verify that "ok" text is displayed
    getByText("ok");
  });

  it("should not render ExternalComponent if result = false", () => {
    // Mocking useExternalHook to return false
    dependencies.useExternalHook = () => false;

    // Render the component
    const { queryByText } = render(<MyComp />);

    // Verify that "ok" text is not displayed
    expect(queryByText("ok")).toBeNull();
  });
});
```

### Inheritance with Local Containers

This example demonstrates how to use local containers in Modelez to implement inheritance-like composition. A base model, AnimalModel, provides shared properties (e.g., species, sound) and behaviors (makeSound). Derived models like DogModel extend the base functionality by adding specific states (breed) and behaviors (fetch). Each instance of the derived models uses an isolated instance of the base model, ensuring state encapsulation and preventing conflicts between instances. This approach mimics inheritance while leveraging the flexibility and modularity of reactive models. 🚀

```ts
import { container, model } from "modelez";

// Define the base Animal model
const AnimalModel = model("animal", ({ state }) => {
  const species = state("Unknown"); // Reactive state for species
  const sound = state("Silent"); // Reactive state for sound

  return {
    species,
    sound,
    setSpecies(value: string) {
      species(value);
    },
    setSound(value: string) {
      sound(value);
    },
    makeSound() {
      return `${species()} makes a '${sound()}' sound.`;
    },
  };
});

// Define the Dog model that "inherits" from Animal
const DogModel = model("dog", ({ use, state }) => {
  // Use Animal locally
  const { species, sound, makeSound, setSpecies, setSound } = use(AnimalModel);
  const breed = state("Unknown Breed"); // Additional state for Dog

  setSpecies("Dog");
  setSound("Bark");

  return {
    // export some Animal's props
    species,
    sound,
    makeSound,

    // export Dog's props
    breed,
    setBreed(value: string) {
      breed(value);
    },
    fetch() {
      return `${species()} fetches the ball!`;
    },
  };
});

const app = container();

const dog = app.get(DogModel);
dog.setBreed("Golden Retriever");

console.log(dog.makeSound()); // Dog makes a 'Bark' sound.
console.log(dog.fetch()); // Dog fetches the ball!
console.log(`Breed: ${dog.breed()}`); // Breed: Golden Retriever
```

---

## API Reference

### `model(name: string, factory: Function)`

Defines a model with reactive states and logic.

- **`name`**: A unique identifier for the model.
- **`factory`**: A function returning the model logic and reactive states.

### `container()`

Creates a container to manage and resolve models.

### `useReactive(model: Model)`

A React hook to use a model's reactive states and methods.

### `effect(dependencies: object, callback: Function)`

Tracks dependencies and re-runs the callback when they change.

### `resource(initializer: Function)`

Creates a reactive async resource.
