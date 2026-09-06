import { v4 } from 'uuid';

export const uuid =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID.bind(crypto)
    : v4;
