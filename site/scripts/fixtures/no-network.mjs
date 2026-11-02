globalThis.fetch = async (url) => {
  throw new Error(`the watcher tests must not reach the network: ${url}`);
};
