declare const __brand: unique symbol;

export type Branded<TValue, TBrand> = TValue & { [__brand]: TBrand };

export type AnyFunc = (...args: any[]) => any;

export type ModelProps = Record<string, any>;

export type ModelInstanceMeta = {
  type: ModelType<any, any>;
};

export type Storage = {
  get(key: string): any;
  has(key: string): boolean;
  set(key: string, value: any): void;
};

export type ReadonlyValue<T> = T extends MutableState<infer V>
  ? State<V>
  : T extends MutableResource<infer V>
  ? Resource<V>
  : T;

export type ModelInstance<P extends ModelProps> = {
  [key in keyof P]: P extends (...args: infer A) => infer R
    ? (...args: A) => ReadonlyValue<R>
    : ReadonlyValue<P[key]>;
} & {
  dispose(): void;
};

export type State<T> = {
  (): T;
} & Observable<T>;

export type MutableState<T> = State<T> & {
  (value: T | ((prev: T) => T)): void;
  dispose(): void;
};

export type MutableResource<T> = Resource<T> & {
  load(): MutableResource<T>;
  reload(): MutableResource<T>;
  dispose(): void;
  pause(): VoidFunction;
};

export type Observable<T> = {
  /**
   * subscribe value change listener
   * @param listener
   */
  subscribe(listener: (value: T) => void): VoidFunction;
};

export type Dependency = AnyFunc | Record<string, any>;

export type DependencyMap = Record<string, Observable<any>>;

export type DependencyAccessors<T> = {
  [key in keyof T]: T[key] extends Observable<infer V> ? V : never;
};

export type LoadableStatus = "idle" | "loading" | "failed" | "succeeded";

export type LoadableIdle = {
  readonly failed: false;
  readonly loading: false;
  readonly error: undefined;
  readonly value: undefined;
  readonly status: "idle";
};

export type LoadableFailed = {
  readonly failed: true;
  readonly loading: false;
  readonly error: unknown;
  readonly value: undefined;
  readonly status: "failed";
};

export type LoadableLoading = {
  readonly failed: false;
  readonly loading: true;
  readonly error: undefined;
  readonly value: undefined;
  readonly status: "loading";
};

export type LoadableSucceeded<T> = {
  readonly failed: false;
  readonly loading: false;
  readonly error: undefined;
  readonly value: T;
  readonly status: "succeeded";
};

export type Loadable<T> =
  | LoadableIdle
  | LoadableFailed
  | LoadableLoading
  | LoadableSucceeded<T>;

export type Resource<T> = PromiseLike<T> &
  Observable<Loadable<T>> &
  Loadable<T>;

export type ModelContext = {
  state<T, D extends DependencyMap>(
    dependencies: D,
    computeFn: (accessors: DependencyAccessors<D>) => T
  ): MutableState<T>;

  state<T>(initialValue: T): MutableState<T>;

  state<T>(key: string, initialValue: T): MutableState<T>;

  /**
   * create a resource from promise object
   * @param promise
   */
  resource<T>(promise: PromiseLike<T>): MutableResource<T>;

  /**
   * create a resource with loadFn and its dependencies
   * @param dependencies
   * @param loadFn
   */
  resource<T, D extends DependencyMap>(
    dependencies: D,
    loadFn: (accessors: DependencyAccessors<D>) => PromiseLike<T>
  ): MutableResource<T>;

  /**
   * create a resource with loadFn
   * @param loadFn
   */
  resource<T>(loadFn: () => PromiseLike<T>): MutableResource<T>;

  /**
   * create a persisted resource, resource data can be loaded from storage and auto save to storage when it changes
   * @param key
   * @param dependencies
   * @param loadFn
   */
  resource<T, D extends DependencyMap>(
    key: string,
    dependencies: D,
    loadFn: (accessors: DependencyAccessors<D>) => Promise<T>
  ): MutableResource<T>;

  /**
   * create a persisted resource with loadFn
   * @param key
   * @param loadFn
   */
  resource<T>(key: string, loadFn: () => PromiseLike<T>): MutableResource<T>;

  /**
   * create an effect that handle reactive change from specific observable objects (resource/state)
   * @param dependencies
   * @param effectFn
   * @param callback
   */
  effect<D extends DependencyMap, R = void>(
    dependencies: D,
    effectFn: (accessors: DependencyAccessors<D>) => R,
    callback?: (result: R) => void
  ): VoidFunction;

  watch<D extends DependencyMap, R>(
    dependencies: D,
    evaluate: (accessors: DependencyAccessors<D>) => R,
    onChange: (result: NoInfer<R>) => void,
    equal?: (a: NoInfer<R>, b: NoInfer<R>) => boolean
  ): VoidFunction;

  on(event: "dispose", listener: VoidFunction): VoidFunction;
  on(event: "init", listener: VoidFunction): VoidFunction;

  /**
   * Resolves a model instance locally without registering it globally, unlike the `get` method.
   *
   * @param type - The model type to resolve.
   * @returns The resolved model instance of the specified type.
   */
  use<T extends ModelProps>(type: ModelType<T>): ModelInstance<T>;

  /**
   * Resolves a model instance locally with a specific key, without registering it globally, unlike the `get` method.
   *
   * @param type - The model type to resolve.
   * @param key - The unique key to identify the model instance.
   * @returns The resolved model instance of the specified type and key.
   */
  use<T extends ModelProps, K>(type: ModelType<T, K>, key: K): ModelInstance<T>;

  use<A extends any[], T>(
    extension: SyncModelExtension<A, T>
  ): (...args: A) => T;

  use<A extends any[], T>(
    loadExtensionPromise: Promise<{
      default: AsyncModelExtension<A, T>;
    }>
  ): (...args: A) => Promise<Awaited<T>>;
} & ModelContainer;

export type SyncModelExtension<A extends any[], T> = (
  context: ModelContext,
  ...args: A
) => T;

export type AsyncModelExtension<A extends any[], T> = (
  context: ModelContext
) => (...args: A) => T;

export type ModelType<P extends ModelProps, K = void> = {
  readonly name: string;
  readonly builder: (context: ModelContext, key: K) => P;
};

export type StorageCollection = Record<string, Storage> & { default: Storage };

export type ModelContainer = {
  readonly storages: StorageCollection;

  /**
   *
   * @param type
   */
  get<P extends ModelProps>(type: ModelType<P, void>): ModelInstance<P>;

  /**
   *
   * @param type
   * @param key
   */
  get<P extends ModelProps, K>(type: ModelType<P, K>, key: K): ModelInstance<P>;

  /**
   *
   * @param key
   */
  get<T extends Dependency>(key: T): T extends ModelType<any, any> ? never : T;

  /**
   *
   * @param type
   */
  getAll<P extends ModelProps>(
    type: ModelType<P, any>
  ): ReadonlyArray<ModelInstance<P>>;

  /**
   * Dispose the model instance associated with the specified key
   * @param type
   */
  delete<P extends ModelProps>(type: ModelType<P, void>): void;

  /**
   * Dispose the model instance associated with the specified key and type.
   * @param type
   * @param key
   */
  delete<P extends ModelProps, K>(type: ModelType<P, K>, key: K): void;

  delete(key: Dependency): void;

  /**
   * Dispose all model instances of the specified type.
   * @param type
   */
  deleteAll<P extends ModelProps>(type: ModelType<P, any>): void;

  /**
   * Dispose all model instances
   */
  deleteAll(): void;

  /**
   * Set dependency
   * @param key
   * @param impl
   */
  set<T extends Dependency>(key: T, impl: T): void;

  /**
   * create proxy of named dependencies
   * @param dependencies
   */
  named<T extends Record<string, any>>(
    dependencies: T
  ): T & { $container: ModelContainer };

  /**
   * backup dependency registry and returns restore function
   */
  backup(): VoidFunction;
};

export type Lazy = { name: string };

export type ReadonlyProps<TProps> = {
  [key in keyof TProps as key extends `set${infer TRest}`
    ? TRest extends Capitalize<TRest>
      ? never
      : TRest
    : key]: TProps[key];
};

export type ReadonlyModel<TModel> = TModel extends ModelType<infer P>
  ? ReadonlyProps<P>
  : never;
