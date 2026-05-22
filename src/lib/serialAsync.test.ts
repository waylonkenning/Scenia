import { describe, it, expect } from 'vitest';
import { createSerialAsyncRunner } from './serialAsync';

const defer = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('createSerialAsyncRunner', () => {
  it('runs tasks in call order even when earlier tasks are still pending', async () => {
    const events: string[] = [];
    const first = defer<void>();

    const run = createSerialAsyncRunner(async (label: string) => {
      events.push(`start:${label}`);
      if (label === 'first') {
        await first.promise;
      }
      events.push(`end:${label}`);
    });

    const firstCall = run('first');
    const secondCall = run('second');

    await Promise.resolve();
    expect(events).toEqual(['start:first']);

    let secondResolved = false;
    secondCall.then(() => {
      secondResolved = true;
    });

    await Promise.resolve();
    expect(secondResolved).toBe(false);

    first.resolve();
    await Promise.all([firstCall, secondCall]);

    expect(events).toEqual([
      'start:first',
      'end:first',
      'start:second',
      'end:second',
    ]);
  });
});
