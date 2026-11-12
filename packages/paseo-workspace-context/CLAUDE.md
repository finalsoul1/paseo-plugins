# paseo-workspace-context

워크스페이스 대화에 나온 티켓·링크와 워크스페이스 자체의 티켓을 Explorer 「참조」 패널에 모아 보여 주는 라이브러리다. 단독으로 설치하는 플러그인이 아니고, 쓰는 플러그인이 어댑터를 붙여 등록한다.

- `src/shared.ts`: RPC 정의(`refs.workspace`, `refs.auto-opened`, `refs.claim-auto-open`)와 스키마, 패널 검색(`matchesSearch`)
- `src/server/`: `createRefsService(adapter)`(에이전트 대화 집계, 고정 영역 중복 제거, 목록 제한, 결과·원본 조회 캐시), `createAutoOpenStore(path)`, URL 추출 도우미
- `src/client/`: `createRefsPanel(options)`, `contributeRefsAutoOpen(client, { panelId })`, `PreviewBody`

참조 종류, 번호 표기 패턴, 원본 조회(이슈 트래커·코드 호스팅 API)는 어댑터(`RefsAdapter`)가 정한다. 종류 이름 중 `link`만 라이브러리가 따로 다룬다(조회 없이 링크 구역에 모은다).

## 작업 규칙

- 회사·개인 업무 정보(사내 호스트, 프로젝트 경로, 티켓 번호 형식)는 넣지 않는다. 저장소가 GitHub에 공개된다.
- 고친 뒤에는 이 라이브러리를 쓰는 플러그인마다 `npm run typecheck` → `paseo plugin reload <id>` → `paseo plugin ls`에서 `running`을 확인한다. 쓰는 플러그인 목록은 `../CLAUDE.local.md`에 있다.
- 모바일 호환 audit: `rg -n "document\.|window\.|localStorage|navigator\.|className=|onClick=" src/`. DOM 접근은 `paseo-ui-kit/src/web.ts`에만 둔다.

## 함정

- 클라이언트 코드가 `paseo-ui-kit`을 import한다. Paseo 컴파일러는 라이브러리의 실제 경로에서 이 이름을 찾으므로, 이 디렉터리에서 `npm install --legacy-peer-deps --no-package-lock`으로 `node_modules/paseo-ui-kit` symlink를 만들어 둬야 한다. 없으면 reload가 `Could not resolve "paseo-ui-kit"`로 실패한다. `--legacy-peer-deps`가 없으면 npm이 `react` 등 peer 의존성까지 설치해 React가 두 벌이 된다.
- 쓰는 쪽 tsconfig에 `"preserveSymlinks": true`가, esbuild로 테스트를 묶을 때는 `--preserve-symlinks`가 있어야 `zod`·`@getpaseo/plugin`이 쓰는 쪽 `node_modules`에서 풀린다.
- 서버 코드와 클라이언트 코드는 `exports`의 `./server`, `./client`로 나눈다. 서버 번들에 `react-native`가 섞이지 않게 하기 위해서다.
