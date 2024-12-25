import {
  ModelProps,
  ModelContainer,
  ModelInstance,
  ModelType,
  Observable,
  Lazy,
} from './types';

import {
  CONTAINER_LAZY_PROP,
  MODEL_CONTAINER_SYMBOL,
  MODEL_INSTANCE_SYMBOL,
  MODEL_TYPE_SYMBOL,
  OBSERVABLE_CURRENT_PROP,
} from './symbols';

export function isObservable<T>(value: any): value is Observable<T> {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    OBSERVABLE_CURRENT_PROP in value
  );
}

export function isModel<T extends ModelProps = any>(
  value: any
): value is ModelInstance<T> {
  return !!value && typeof value === 'object' && value[MODEL_INSTANCE_SYMBOL];
}

export function isType<T extends ModelProps = any>(
  value: any
): value is ModelType<T> {
  return !!value && typeof value === 'object' && value[MODEL_TYPE_SYMBOL];
}

export function isContainer(value: any): value is ModelContainer {
  return !!value && typeof value === 'object' && value[MODEL_CONTAINER_SYMBOL];
}

export function lazy<T>(create: () => T, dispose?: (value: T) => void) {
  let current: { value: T } | undefined;
  return {
    get value() {
      if (!current) {
        current = { value: create() };
      }
      return current.value;
    },
    hasValue() {
      return !!current;
    },
    dispose() {
      if (current) {
        dispose?.(current.value);
      }
    },
  };
}

export function getObservableGetter<T>(observable: Observable<T>): () => T {
  const getter = (observable as any)[OBSERVABLE_CURRENT_PROP];
  return getter;
}

export function noop() {}

export function isLazy(value: any): value is Lazy {
  return !!value && typeof value === 'object' && value[CONTAINER_LAZY_PROP];
}

const TypeOf = (value: unknown) => typeof value;

export function is<T>(
  value: unknown,
  baseType: ReturnType<typeof TypeOf>
): value is T {
  return typeof value === baseType;
}
