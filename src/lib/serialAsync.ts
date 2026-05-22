export const createSerialAsyncRunner = <TArgs extends unknown[], TResult>(
  task: (...args: TArgs) => Promise<TResult>,
) => {
  let tail = Promise.resolve();

  return (...args: TArgs) => {
    const run = tail.then(
      () => task(...args),
      () => task(...args),
    );
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
};
