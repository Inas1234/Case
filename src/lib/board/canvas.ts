export const BOARD_MIN_ZOOM = 0.2;
export const BOARD_MAX_ZOOM = 1.8;
export const DEFAULT_BOARD_ZOOM = 1;
export const DEFAULT_BOARD_PAN = { x: 340, y: 220 } as const;

export interface CanvasViewport {
  pan: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  zoom: number;
}

export function clampBoardZoom(value: number) {
  return Math.max(BOARD_MIN_ZOOM, Math.min(BOARD_MAX_ZOOM, Number(value.toFixed(2))));
}
