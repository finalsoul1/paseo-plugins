// 괄호·따옴표·백틱·한글은 URL 에 넣지 않는다. 마크다운 링크와 「...442에」 같은 문장 속 URL 을 끊기 위해서다.
const URL_PATTERN = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?*]+$/;

// 메시지의 URL 을 넘겨주고, URL 자리를 공백으로 지운 글을 돌려준다.
// URL 안의 번호나 #fragment 를 기호 표기로 두 번 세지 않게 하려는 것이다. 공백으로 지워서 index 는 그대로 맞는다.
export function blankUrls(text: string, onUrl: (url: string, index: number) => void): string {
  return text.replace(URL_PATTERN, (match, offset: number) => {
    onUrl(match, offset);
    return " ".repeat(match.length);
  });
}

// 끝의 문장부호를 떼고, 참조로 볼 수 없는 URL(localhost, 호스트만 있는 주소)은 null 이다.
export function parseReferenceUrl(raw: string): { url: string; parsed: URL } | null {
  const url = raw.replace(TRAILING_PUNCTUATION, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return null;
  // 호스트만 있는 URL 은 서비스 이름일 뿐 참조가 아니다.
  if (parsed.pathname === "/" && !parsed.search) return null;
  return { url, parsed };
}
