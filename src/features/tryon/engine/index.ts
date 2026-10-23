import type { TryOnEngine } from '../../../shared/types';

const notImplemented = (): never => {
  throw new Error('not implemented');
};

export function createTryOnEngine(): TryOnEngine {
  return {
    async start() { notImplemented(); },
    stop() { notImplemented(); },
    async setFrame() { notImplemented(); },
  };
}
