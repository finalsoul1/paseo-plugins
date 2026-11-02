# paseo-plugins

[Paseo](https://paseo.sh)용 개인 플러그인 모음이다.

| 디렉터리 | 내용 |
| --- | --- |
| `paseo-agent-history` | 검색, 보관, 상태, 프로젝트, 기간 등으로 거를 수 있는 에이전트 기록 화면. 사이드바와 ⌘K로 연다. |
| `paseo-ui-kit` | 플러그인들이 같이 쓰는 client UI와 웹 단축키. 단독으로 설치하는 플러그인이 아니다. |

## 설치

```sh
git clone <이 저장소 URL> paseo-plugins
cd paseo-plugins/paseo-agent-history
npm install
paseo plugin install "$PWD"
```

플러그인은 `"paseo-ui-kit": "file:../paseo-ui-kit"`로 키트를 참조하므로, 저장소를 통째로 받아 디렉터리 구조를 유지해야 한다.
