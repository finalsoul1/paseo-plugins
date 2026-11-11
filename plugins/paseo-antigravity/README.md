# paseo-antigravity

[Paseo](https://paseo.sh)에서 Google Antigravity CLI(`agy`)를 안정적으로 연동하기 위한 **영속적 프로바이더 플러그인(`Antigravity (Persistent)`) 및 사용량(Usage) 소스**입니다.

Paseo에 기본 탑재된 내장 `antigravity-provider`의 구조적 한계와 안정성 결함을 해결하기 위해 제작되었습니다.

---

## 💡 왜 만들어졌는가? (배경 및 문제 의식)

Paseo의 기존 내장 Antigravity 연동에는 실제 개발 환경에서 지속적으로 사용하기 어려운 몇 가지 중대한 문제들이 있었습니다.

### 1. 세션 히스토리 유실 (재접속 시 빈 화면)
* **기존 문제**: 기존 프로바이더는 세션을 다시 열거나 Paseo 데몬을 재시작했을 때 과거 대화 내역(`transcript`)을 복원하지 못했습니다. 그 결과 세션을 다시 열면 이전 작업 내역(질문, 사고 과정, 도구 실행 결과, 답변)이 모두 사라진 빈 화면으로 표시되어 컨텍스트가 끊겼습니다.
* **터미널 세션과의 단절**: 터미널에서 독립적으로 실행했던 `agy` 세션들을 Paseo로 가져올 수 있는 세션 목록 조회(`session.list`) 인터페이스가 구현되어 있지 않았습니다.

### 2. macOS 환경에서의 데몬 크래시 (`kill EPERM`)
* **기존 문제**: 세션을 정리하거나 유휴(idle) 프로세스를 종료할 때 POSIX 프로세스 그룹 킬(`killProcessGroup`)을 호출하는데, macOS 환경에서는 자식 프로세스 상태 및 샌드박스 권한 문제로 인해 불시에 `kill EPERM` 에러가 발생했습니다.
* **영향**: 이 에러가 예외 처리 없이 상위로 전파되면서 **Paseo 백엔드 데몬 전체가 비정상 종료(Crash)**되어 다른 작업 중이던 세션들까지 함께 강제 종료되는 치명적인 문제가 있었습니다.

### 3. 단순 조회 시 불필요한 무거운 프로세스 기동
* **기존 문제**: 과거 대화 내역을 확인하거나 세션 목록을 훑어보는 읽기 작업 시에도 무거운 `agy` 드라이버 프로세스를 매번 백그라운드에 띄워 CPU와 메모리 자원을 낭비했습니다.

### 4. 도구 실행 이벤트(Timeline) 시각화 부재
* **기존 문제**: Antigravity의 대표 도구들(`read_file`, `write_file`, `edit_file`, `run_command`, `search_web`, `invoke_subagent` 등)의 실행 이벤트가 Paseo 타임라인 UI의 상태/결과와 온전히 매핑되지 않아 도구가 무엇을 수정했는지 한눈에 파악하기 어려웠습니다.

### 5. 모델별 사용량(Quota / Limits) 모니터링 부재
* **기존 문제**: Codex나 Cursor 등은 남은 사용량 및 리셋 주기 확인이 가능했으나, Antigravity(Gemini 4 Argon Weekly, Gemini 5-hour, Claude & GPT 한도, 잔여 크레딧 등)는 Paseo 사용량 대시보드에서 조회할 방법이 없었습니다.

---

## ✨ 핵심 기능 및 해결책

### 1. 온전한 대화 기록 복원 (`history: "replay"`)
- Antigravity가 기록하는 `~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript_full.jsonl` 파일을 직접 읽어옵니다.
- 유저 메시지, 모델의 생각 과정(Thinking), 어시스턴트 응답, 도구 호출 및 결과까지 타임라인 상에 누락 없이 복원합니다.

### 2. 세션 가져오기 지원 (`session.list`)
- Antigravity의 `conversation_summaries.db` 및 brain transcripts 디렉터리를 스캔하여, 외부 터미널에서 실행했던 `agy` 작업 내역도 Paseo 세션 가져오기 모달에서 그대로 불러올 수 있습니다.

### 3. 지연 기동 (Lazy Driver Startup)
- 세션을 열람하거나 기록을 탐색할 때는 `agy` 프로세스를 실행하지 않습니다.
- 사용자가 실제로 새 프롬프트를 전송하는 시점에만 필요한 프로세스를 지연 기동(Lazy initialization)하여 리소스 낭비를 방지합니다.

### 4. 프로세스 그룹 종료 예외 처리 (macOS 데몬 크래시 방지)
- `server/internal/signals.ts`에서 프로세스 종료 시그널 전송 시 `EPERM` 및 `ESRCH` 예외를 안전하게 catch하고 graceful fallback 처리하여 macOS에서 데몬이 크래시되는 현상을 원천 차단했습니다.

### 5. Antigravity 도구 이벤트 세부 매핑
- 파일 읽기/쓰기/수정, 터미널 명령 실행, 웹 검색, 서브에이전트 호출 이벤트를 Paseo 타임라인 UI 규격에 맞게 매핑하여 코드 diff와 실행 결과를 직관적으로 표시합니다.

### 6. 실시간 사용량 소스 연동 (`registerUsageSource`)
- `server/usage.ts`를 통해 Antigravity API 크레딧 및 모델군별 쿼터 사용량을 조회하여 등록합니다.
- Paseo의 "사용량(Usage)" 팝업에서 **Gemini 4 Argon (Weekly)**, **Gemini Models (5-hour / Weekly)**, **Claude & GPT (5-hour / Weekly)** 사용률 및 잔여 크레딧, 리셋 예정 시간을 실시간으로 확인할 수 있습니다.

---

## 🛠️ 설치 및 설정

### 1. 플러그인 빌드 및 설치

```sh
cd paseo-plugins/plugins/paseo-antigravity
npm install
paseo plugin install "$PWD"
```

### 2. 설정 (`~/.paseo/config.json`)

기존 내장 `antigravity` 대신 이 플러그인(`agy`)을 활성화합니다:

```json
{
  "plugins": {
    "paseo-antigravity": {
      "source": "directory",
      "path": "/절대경로/paseo-plugins/plugins/paseo-antigravity",
      "enabled": true
    }
  },
  "agents": {
    "providers": {
      "antigravity": {
        "enabled": false
      },
      "agy": {
        "command": ["agy"],
        "enabled": true
      }
    }
  }
}
```

기본 모델은 `~/.gemini/antigravity-cli/settings.json`의 `model` 설정값(미설정 시 `gemini-4-argon-medium`)을 자동으로 따릅니다.

---

## 📜 라이선스 (License & Attribution)

본 플러그인은 [Paseo](https://github.com/getpaseo/paseo)의 내장 `antigravity-provider` 코드를 기반으로 파생 및 개선되었습니다.
원작성자의 저작권 및 라이선스 정책을 준수하여 **Apache License, Version 2.0**을 따릅니다. 상세 수정 내역 및 고지는 [NOTICE](./NOTICE) 및 [LICENSE](./LICENSE) 파일을 참고하십시오.
