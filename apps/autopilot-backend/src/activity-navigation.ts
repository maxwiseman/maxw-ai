export interface ActivityNavigationState {
  frameUrl: string;
  previewSource: string | null;
  progress: string | null;
}

interface FrameProgress {
  current: number;
  total: number;
}

export function parseFrameProgress(value: string | null): FrameProgress | null {
  if (!value) return null;
  const match = /(?:^|\s)(\d+)\s+of\s+(\d+)(?:\s|$)/i.exec(value);
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(current) || !Number.isInteger(total) || total < 1) {
    return null;
  }
  return { current, total };
}

export function didAdvanceActivity(
  before: ActivityNavigationState,
  after: ActivityNavigationState,
): boolean {
  const beforeProgress = parseFrameProgress(before.progress);
  const afterProgress = parseFrameProgress(after.progress);

  if (beforeProgress && afterProgress) {
    if (beforeProgress.total === afterProgress.total) {
      if (afterProgress.current > beforeProgress.current) return true;
      return (
        beforeProgress.current === beforeProgress.total &&
        afterProgress.current === 1
      );
    }
    return afterProgress.current === 1;
  }

  if (before.progress !== after.progress && after.progress !== null)
    return true;
  if (
    before.previewSource !== after.previewSource &&
    after.previewSource !== null
  ) {
    return true;
  }
  return before.frameUrl !== after.frameUrl;
}
