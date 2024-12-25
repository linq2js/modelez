import { createEffect } from './createEffect';
import { createStaticState } from './createStaticState';
import { DependencyAccessors, DependencyMap, MutableState } from './types';

export function createComputedState<T, D extends DependencyMap>(
  dependencies: D,
  computeFn: (accessors: DependencyAccessors<D>) => T
): MutableState<T> {
  const state = createStaticState<T | undefined>(undefined);
  const disposeEffect = createEffect(dependencies, (accessors) => {
    const value = computeFn(accessors);
    state(value);
  });
  const originalDispose = state.dispose;
  Object.assign(state, {
    dispose() {
      disposeEffect();
      originalDispose();
    },
  });
  return state as MutableState<T>;
}
