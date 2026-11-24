# paseo-html-viewer

`.html`·`.htm` 파일을 렌더링하고 ⌘F로 문서 안을 찾는 Paseo 파일 패널 플러그인이다. 동작 규칙과 결정 근거는 `docs/specs/`에 있다.

## 구조

- `client/document.ts`: iframe에 넣을 문서를 만든다. 내장 뷰어와 같은 CSP, 하이라이트 스타일, 찾기 스크립트(문자열)를 HTML 앞에 붙인다. 바깥과 주고받는 메시지 형식도 여기에 있다.
- `client/web.ts`: iframe, `postMessage`, ⌘F 가로채기처럼 DOM이 필요한 코드는 이 파일에만 둔다.
- `client/panel.tsx`·`client/find-bar.tsx`: 패널과 찾기 바. React Native 요소만 쓴다.

## 작업 규칙

- 고친 뒤 순서: `npm run typecheck` → `paseo plugin reload paseo-html-viewer` → `paseo plugin ls`에서 `running` 확인 → `paseo plugin logs paseo-html-viewer`. 데몬 재시작은 하지 않는다.
- 모바일 호환 audit: `rg -n "document\.|window\.|localStorage|navigator\.|<[a-z]+[ >]|className=|onClick=" client/`. `client/web.ts`와 `client/document.ts`의 찾기 스크립트 문자열 밖에서 걸리면 버그다.
- 찾기 스크립트는 타입체크가 되지 않는다. 고치면 `client/document.ts`를 esbuild로 묶어 `buildDocument` 결과를 `sandbox="allow-scripts"` iframe의 `srcdoc`에 넣은 시험 페이지를 만들고, 브라우저에서 `postMessage`로 검색해 개수·이동·하이라이트를 확인한다. 시험 페이지에는 `<meta charset="utf-8">`을 넣는다. 없으면 `srcdoc`의 한글이 깨져 한글 검색이 0건으로 나온다.
- 공통 UI(`Button`, `SearchInput`, `SPACE`)와 `addWebShortcut`·`isShown`은 `../../packages/paseo-ui-kit`에 있다.

## 함정

- iframe에 `allow-same-origin`을 주지 않는다. 주면 문서 스크립트가 Paseo 앱과 같은 출처가 되어 앱의 DOM과 저장소에 접근할 수 있다. 그래서 바깥에서 iframe DOM을 읽지 못하고, 찾기는 iframe 안 스크립트가 하고 결과만 메시지로 받는다.
- iframe에 포커스가 있으면 키 입력이 바깥 문서로 오지 않는다. iframe 안의 ⌘F는 찾기 스크립트가 `open-find` 메시지로 넘긴다.
- React Native Web의 `TextInput`은 Enter 뒤에 포커스를 뺀다. 찾기 바는 `onKeyPress`에서 `preventDefault`로 막는다. 한글 조합 중 Enter(`isComposing`, `keyCode` 229)는 이동으로 처리하지 않는다.
- 내장 뷰어는 `data:` URL을 쓰지만 이 패널은 `srcdoc`을 쓴다. Chromium의 URL 길이 한도(2MB) 때문에 큰 문서는 `data:` URL로 열리지 않을 수 있어서다. 이 한도에 걸리는지 실측하지는 않았다.
