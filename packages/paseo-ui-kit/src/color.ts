// 테마 색은 대개 #rrggbb 라서 알파를 붙여 옅게 만든다. 다른 형식이면 옅게 만들 수 없어 대체 색을 쓴다.
export function tint(color: string, alpha: number, fallback: string): string {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return `#${full}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}
