# paseo-agent-history

Paseo 기본 「기록」 화면에 없는 필터(검색, 보관, 상태, 확인 필요, 프로젝트, 출처, 프로바이더, 기간)가 있는 에이전트 기록 화면을 제공하는 Paseo 플러그인이다. 진입점은 사이드바 헤더 항목과 ⌘K다. 화면 규칙과 결정 근거는 `docs/specs/`에 있다.

## 작업 규칙

- 화면 구조나 필터를 바꿀 때는 `docs/specs/제목-날짜.md` 스펙을 먼저 쓰고, 끝나면 완료 기준을 실측 결과로 채운다.
- 고친 뒤 순서: `npm run typecheck` → `paseo plugin reload paseo-agent-history` → `paseo plugin ls`에서 `running` 확인 → `paseo plugin logs paseo-agent-history`. 데몬 재시작은 하지 않는다.
- 모바일 호환 audit: `rg -n "document\.|window\.|localStorage|navigator\.|className=|onClick=" client/`. 걸리면 버그다. DOM에 접근하는 코드는 `paseo-ui-kit/src/web.ts`에만 둔다.
- 필터 로직 검증은 `client/filters.ts`와 `client/queries.ts`의 `fetchAll`을 esbuild로 묶어(`@getpaseo/plugin/client`, `@tanstack/react-query`는 `--alias`로 빈 모듈로 바꾼다) 실제 데몬 데이터로 Node에서 돌리고, 원본 응답으로 따로 센 값과 맞춘다. `@getpaseo/client`는 묶지 말고 이 디렉터리의 `.mjs`에서 import한다(tweetnacl의 동적 require 때문에 묶으면 깨진다). esbuild는 이 저장소에 없어서 npx로 받는다.
- 공통 UI(`Button`, `Chip`, `Segmented`, `LoadingText`, `SearchInput`, `SPACE`, `useHover`, `tint`)와 왼쪽 칸 배치(`useSideLayout`, `SideSplit`, `SideTitle`, `contentStyle`)와 웹 단축키(`useWebShortcut`, `useWebEscape`, `webKeyDown` 등)는 `../../packages/paseo-ui-kit`에 있다. 고칠 때는 그 디렉터리의 `CLAUDE.md`를 따른다.
- git 저장소 루트는 상위 디렉터리 `paseo-plugins/`이고 GitHub에 올라간다. 회사 업무 정보(사내 서비스·저장소 이름, 실측 데이터에 나온 프로젝트 이름)는 커밋하지 않고 `../CLAUDE.local.md`에 둔다.

## 함정

- `paseo.agents.list`(`fetch_agents_request`)에는 `search`가 없고, 플러그인 SDK에는 `fetch_agent_history_request`를 부르는 메서드가 없다. 그래서 전부 받아 클라이언트에서 거른다.
- `page.limit`은 200까지만 된다. 넘기면 클라이언트의 요청 검증(Zod)에서 바로 거절된다.
- `includeArchived`를 빼면 아카이브되지 않은 에이전트만 온다(2026-10-28 실측 555개 중 20개).
- 플러그인 RPC는 30초에서 끊기고, 이름은 소문자·숫자·`.`·`-`·`_`만 된다. 지금은 서버 엔트리와 RPC가 없다.
- ⌘L은 Paseo의 "메시지 입력창 포커스" 단축키다. 이 플러그인은 기록 화면이 실제로 보일 때만 가로챈다. 화면 단축키(⌘L, Esc, 열 때 포커스, 화살표 이동)와 ⌘Y는 `paseo-ui-kit`의 `useScreenKeys`, `listNavKey`, `inputListKey`, `addScreenShortcut`을 다른 플러그인과 같이 쓴다. 키 동작을 바꿀 때는 키트에서 고친다.
- 에이전트 열기는 화면 props의 `navigation.openAgent`로 한다. 오래된 호스트에는 `navigation`이 없어서 그때는 행을 누를 수 없게 둔다.
