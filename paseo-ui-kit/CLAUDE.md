# paseo-ui-kit

여러 Paseo 플러그인이 같이 쓰는 client UI(간격 `SPACE`, `useHover`, `tint`, `Button`, `Chip`, `Segmented`, `LoadingText`)와 웹 전용 코드(`src/web.ts`: 단축키, Esc, 화면 표시 여부, 뒤로 가기)다. 한 플러그인에서만 쓰는 컴포넌트는 그 플러그인 `client/`에 둔다. `web.ts`는 예외로, 한쪽만 쓰는 함수(`useModifierHeld`, `clearTextSelection`, `isRouteOpen`)도 여기에 둔다. DOM 접근과 `window`·`navigator` 타입 선언을 한 파일에 모아 두기 위해서다.

## 작업 규칙

- 고친 뒤에는 이 키트를 쓰는 플러그인마다 `npm run typecheck` → `paseo plugin reload <id>` → `paseo plugin ls`에서 `running`을 확인한다. 키트는 따로 빌드하지 않고, 플러그인을 reload할 때 함께 번들된다.
- 간격은 `SPACE` 값(4, 8, 12, 16, 24)에서만 고른다. 컴포넌트 높이와 테두리는 직접 명시해도 된다.
- 모바일 호환 audit: `rg -n "document\.|window\.|localStorage|navigator\.|className=|onClick=" src/`. `src/web.ts` 밖에서 걸리면 버그다.
- 이 키트를 쓰는 플러그인 목록은 저장소 루트 `README.md`에 있다. 저장소 밖에서 쓰는 플러그인은 `../CLAUDE.local.md`에 있다.
- git 저장소 루트는 상위 디렉터리 `paseo-plugins/`이고 GitHub에 올라간다. 회사 업무 정보는 커밋하지 않고 `../CLAUDE.local.md`에 둔다.

## 함정

- 플러그인은 `"paseo-ui-kit": "file:../paseo-ui-kit"`(symlink)로 쓴다. Paseo 컴파일러는 `package.json`의 `name`이 import 이름과 같은 바깥 패키지를 linked dependency로 받아 준다. 이름을 바꾸면 번들이 깨진다.
- 키트에는 `node_modules`가 없다. 그래서 쓰는 쪽 tsconfig에 `"preserveSymlinks": true`가 있어야 `react` 타입이 플러그인 쪽에서 풀린다.
- 이 디렉터리의 `tsconfig.json`(`"jsx": "react-jsx"`)을 지우지 않는다. esbuild는 파일과 가장 가까운 tsconfig를 읽기 때문에, 없으면 `.tsx`가 classic JSX로 바뀌어 `React is not defined`가 난다.
