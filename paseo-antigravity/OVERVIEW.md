Antigravity CLI(`agy`) 세션을 대화 기록 복원(`history: "replay"`)과 함께 연결하는 프로바이더 플러그인이다. 설치하면 프로바이더 목록에 `Antigravity (Persistent)`(`id: "agy"`)로 등록된다.

세션을 다시 열거나 가져올 때 `~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript_full.jsonl`을 읽어 질문, 추론, 답변, 도구 실행 기록을 타임라인에 복원한다. 기록 조회 단계에서는 `agy` 프로세스를 미리 띄우지 않고 실제 메시지를 보낼 때만 실행하며, macOS 유휴 프로세스 종료 시 발생하던 `kill EPERM` 데몬 크래시도 막는다.

`session.list`를 지원하므로 기존 내장 `antigravity` 프로바이더에서 빈 화면이 된 세션이나 터미널에서 실행한 `agy` 세션도 Paseo의 세션 가져오기 화면에서 불러올 수 있다. 기본 모델은 `~/.gemini/antigravity-cli/settings.json`의 `model` 값(미설정 시 `gemini-4-argon-medium`)을 따르며, `Antigravity` 사용량 소스(`registerUsageSource`)도 함께 등록해 Paseo 사용량 창에서 모델군별 한도와 크레딧을 조회한다.
