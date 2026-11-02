import { useState } from "react";

// 모바일에는 호버가 없어서 이 값은 웹에서만 true 가 된다. 눌림은 Pressable 의 pressed 로 따로 처리한다.
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return [hovered, { onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false) }] as const;
}

export const PRESSED_OPACITY = 0.75;
