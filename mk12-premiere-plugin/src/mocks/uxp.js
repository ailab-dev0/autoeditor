/**
 * Browser mock for UXP module — used in preview mode only.
 */
export const entrypoints = {
  setup() {},
};

export const storage = {
  localFileSystem: {
    getDataFolder: () => Promise.resolve(null),
  },
};
