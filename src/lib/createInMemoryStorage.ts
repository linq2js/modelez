import { Storage } from './types';

export function createInMemoryStorage(): Storage {
  return new Map<string, any>();
}
