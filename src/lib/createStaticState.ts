import { callbackGroup } from './callbackGroup';
import { OBSERVABLE_CURRENT_PROP } from './symbols';
import { MutableState } from './types';

export function createStaticState<T>(initialValue: T): MutableState<T> {
  let currentValue = initialValue;
  const changeNotifier = callbackGroup();

  return Object.assign(
    (...args: any[]): any => {
      // getter
      if (!args.length) {
        return currentValue;
      }

      // setter
      const newValue =
        typeof args[0] === 'function' ? args[0](currentValue) : args[0];

      if (currentValue !== newValue) {
        currentValue = newValue;
        changeNotifier.invoke(newValue);
      }

      return;
    },
    {
      [OBSERVABLE_CURRENT_PROP]() {
        return currentValue;
      },
      subscribe: changeNotifier,
      dispose() {
        changeNotifier.clear();
      },
    }
  );
}
