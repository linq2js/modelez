import { ModelContext } from './types';

export default function sum(_: ModelContext) {
  return async (a: number, b: number) => a + b;
}
