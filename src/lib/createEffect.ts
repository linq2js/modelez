import { callbackGroup } from './callbackGroup';
import { DependencyAccessors, DependencyMap } from './types';
import { getObservableGetter } from './utils';

export function createEffect<D extends DependencyMap, R = void>(
  dependencies: D,
  fn: (accessors: DependencyAccessors<D>) => R,
  callback?: (result: NoInfer<R>) => void
): VoidFunction {
  const cleanupNotifier = callbackGroup();
  const handleChange = () => {
    cleanupNotifier.invokeAndClear();
    const result = fn(accessors as DependencyAccessors<D>);
    callback?.(result);
  };
  const accessors: Record<string, any> = new Proxy(
    {},
    {
      get(_, key) {
        const observable = dependencies[key as any];
        cleanupNotifier(observable.subscribe(handleChange));
        return getObservableGetter(observable)();
      },
    }
  );
  const result = fn(accessors as DependencyAccessors<D>);
  callback?.(result);

  return () => {
    cleanupNotifier.invokeAndClear();
  };
}

export function createWatcher<D extends DependencyMap, R>(
  dependencies: D,
  evaluate: (accessors: DependencyAccessors<D>) => R,
  onChange: (result: NoInfer<R>) => void,
  equal: (a: NoInfer<R>, b: NoInfer<R>) => boolean = Object.is
) {
  let current: { value: R } | undefined;

  return createEffect(dependencies, (accessors) => {
    const next = evaluate(accessors);
    if (!current) {
      current = { value: next };
    } else if (!equal(current.value, next)) {
      current = { value: next };
      onChange(next);
    }
  });
}
