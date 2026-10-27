import { create } from "zustand";
import type { DriveRecord } from "../sim/DriveSim.ts";

// The finished drive crosses from /drive to /analyze through here. Per-frame sim state never does
// (it lives in the DriveSim instance and is read through refs / throttled hooks).
interface DriveStore {
  record: DriveRecord | null;
  /** bumped every replay so the question round varies between attempts */
  attempt: number;
  setRecord: (r: DriveRecord) => void;
  nextAttempt: () => void;
}

export const useDriveStore = create<DriveStore>((set) => ({
  record: null,
  attempt: 0,
  setRecord: (record) => set({ record }),
  nextAttempt: () => set((s) => ({ attempt: s.attempt + 1 })),
}));
