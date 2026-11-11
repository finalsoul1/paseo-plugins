# paseo-plugins

[Paseo](https://paseo.sh)용 개인 플러그인 모음이다.

## 기능

| 디렉터리 | 내용 |
| --- | --- |
| `plugins/paseo-agent-history` | 검색, 보관, 상태, 프로젝트, 기간 등으로 거를 수 있는 에이전트 기록 화면. 사이드바, ⌘K, ⌘Y로 연다. |
| `plugins/paseo-antigravity` | `transcript_full.jsonl` 대화 기록 복원, 세션 가져오기(`session.list`), 한도·크레딧 사용량 표시(`registerUsageSource`), macOS 종료 시 `EPERM` 방지를 포함한 Antigravity CLI 프로바이더(`Antigravity (Persistent)`). `getpaseo/paseo` 기반 코드이므로 이 디렉터리는 Apache-2.0을 따른다. |
| `plugins/paseo-appearance` | `client/appearance.json`에 적어 둔 글꼴·크기 등 모양 설정을 앱 로드 시 맞춘다. 파일을 고치면 `paseo plugin reload paseo-appearance`로 반영한다. |
| `packages/paseo-ui-kit` | 플러그인들이 같이 쓰는 client UI와 웹 단축키. 단독으로 설치하는 플러그인이 아니다. |

## 테마

모두 라이트 테마이고, 설치하면 Settings → Appearance에 나온다.

| 디렉터리 | 내용 |
| --- | --- |
| `themes/paseo-catppuccin-latte` | Catppuccin 공식 팔레트의 Latte 색을 옮겼다. |
| `themes/paseo-github-light` | GitHub Primer의 라이트 색을 옮겼다. |
| `themes/paseo-gruvbox-light` | gruvbox의 라이트(중간 대비) 색을 옮겼다. |
| `themes/paseo-gruvbox-paper` | `paseo-gruvbox-light`에서 출발해 배경의 채도를 절반으로 낮춰 덜 노랗게 만들었다. 글자와 강조색은 같다. |
| `themes/paseo-one-light` | Zed의 One Light 색을 옮겼다. |
| `themes/paseo-quiet-light` | VS Code의 Quiet Light 색을 옮겼다. |
| `themes/paseo-rose-pine-dawn` | Rosé Pine의 Dawn 색을 옮겼다. |
| `themes/paseo-solar-paper` | `paseo-solarized-light`에서 출발해 배경을 흰색 쪽으로 옅게 하고, 글자와 테두리는 더 진하게 만들었다. |
| `themes/paseo-solarized-light` | Solarized Light 색을 옮겼다. 배경 톤이 모자라 두 색은 섞어서 만들었다. |

## 설치

```sh
git clone <이 저장소 URL> paseo-plugins
cd paseo-plugins/plugins/paseo-agent-history
npm install
paseo plugin install "$PWD"
```

다른 플러그인과 테마도 그 디렉터리에서 같은 방법으로 설치한다. 기능 플러그인은 `plugins/`, 테마는 `themes/`, 여러 플러그인이 같이 쓰는 라이브러리는 `packages/`에 있다. `paseo-agent-history`는 `"paseo-ui-kit": "file:../../packages/paseo-ui-kit"`로 키트를 참조하므로, 저장소를 통째로 받아 디렉터리 구조를 유지해야 한다.
