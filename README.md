# paseo-plugins

[Paseo](https://paseo.sh)용 개인 플러그인 모음이다.

| 디렉터리 | 내용 |
| --- | --- |
| `paseo-agent-history` | 검색, 보관, 상태, 프로젝트, 기간 등으로 거를 수 있는 에이전트 기록 화면. 사이드바와 ⌘K로 연다. |
| `paseo-catppuccin-latte` | Catppuccin 공식 팔레트의 Latte 색을 옮긴 라이트 테마. |
| `paseo-github-light` | GitHub Primer의 라이트 색을 옮긴 라이트 테마. |
| `paseo-gruvbox-light` | gruvbox의 라이트(중간 대비) 색을 옮긴 라이트 테마. |
| `paseo-one-light` | Zed의 One Light 색을 옮긴 라이트 테마. |
| `paseo-quiet-light` | VS Code의 Quiet Light 색을 옮긴 라이트 테마. |
| `paseo-rose-pine-dawn` | Rosé Pine의 Dawn 색을 옮긴 라이트 테마. |
| `paseo-solar-paper` | `paseo-solarized-light`에서 출발해 배경을 흰색 쪽으로 옅게 하고, 글자와 테두리는 더 진하게 만든 라이트 테마. |
| `paseo-solarized-light` | Solarized Light 색을 옮긴 라이트 테마. 배경 톤이 모자라 두 색은 섞어서 만들었다. |
| `paseo-ui-kit` | 플러그인들이 같이 쓰는 client UI와 웹 단축키. 단독으로 설치하는 플러그인이 아니다. |

## 설치

```sh
git clone <이 저장소 URL> paseo-plugins
cd paseo-plugins/paseo-agent-history
npm install
paseo plugin install "$PWD"
```

다른 플러그인도 그 디렉터리에서 같은 방법으로 설치한다. `paseo-agent-history`는 `"paseo-ui-kit": "file:../paseo-ui-kit"`로 키트를 참조하므로, 저장소를 통째로 받아 디렉터리 구조를 유지해야 한다.
