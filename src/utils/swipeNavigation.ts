export interface SwipeGestureOptions {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  minDistance?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

/**
 * Calculates horizontal gesture intent and triggers next/previous question.
 * Ignores vertical page scrolls (e.g. reading long explanations).
 */
export function handleSwipeGesture({
  startX,
  startY,
  endX,
  endY,
  minDistance = 50,
  onSwipeLeft,
  onSwipeRight,
}: SwipeGestureOptions): 'left' | 'right' | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  // Horizontal motion must significantly dominate vertical motion
  if (Math.abs(deltaX) < minDistance || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) {
    return null;
  }

  if (deltaX < 0) {
    onSwipeLeft();
    return 'left';
  } else {
    onSwipeRight();
    return 'right';
  }
}
