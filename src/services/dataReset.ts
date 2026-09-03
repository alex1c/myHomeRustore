/**
 * App-wide data reset signal — bumps epoch after successful restore.
 */

type Listener = (epoch: number) => void;

let epoch = 0;
const listeners = new Set<Listener>();

export function getDataEpoch(): number {
  return epoch;
}

/** Notify subscribers that user data was replaced (restore). */
export function notifyDataReset(): number {
  epoch += 1;
  for (const listener of [...listeners]) {
    try {
      listener(epoch);
    } catch {
      // One mounted screen must not prevent other screens from reloading.
    }
  }
  return epoch;
}

export function subscribeDataReset(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
