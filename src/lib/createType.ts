import { MODEL_TYPE_SYMBOL } from './symbols';
import { ModelProps, ModelContext, ModelType } from './types';

export function createType<T extends ModelProps, K = void>(
  name: string,
  builder: (context: ModelContext, key: K) => T
): ModelType<T, K> {
  return {
    [MODEL_TYPE_SYMBOL as any]: true,
    builder,
    name,
  };
}
