import type { ArEngine } from '../../../shared/types';

const notImplemented = (): never => {
  throw new Error('not implemented');
};

export function createArEngine(): ArEngine {
  return {
    async isSupported() { return notImplemented(); },
    async start() { notImplemented(); },
    stop() { notImplemented(); },
    async setModel() { notImplemented(); },
  };
}
