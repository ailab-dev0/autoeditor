/**
 * Browser mock for premierepro module — used in preview mode only.
 * Returns mock data so the UI can render without Premiere.
 */
const mockProject = {
  guid: 'mock-project-guid',
  name: 'Mock Project',
};

export const Project = {
  getActiveProject: async () => mockProject,
};

export const Constants = {
  TrackItemType: { EMPTY: 0, CLIP: 1, TRANSITION: 2 },
};

export const TickTime = {
  createWithSeconds: (s) => ({ seconds: s, ticks: String(Math.round(s * 254016000000)), ticksNumber: Math.round(s * 254016000000) }),
};

export const ClipProjectItem = {
  cast: (item) => item,
};

export const FolderItem = {
  cast: (item) => item,
};
