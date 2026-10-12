# 브라우저 자동편집기

`#production`은 `browser-editor.js`와 `browser-editor.css`를 사용합니다. 맥 앱과 로컬 실행 프로그램은 필요하지 않습니다.

## 지원하는 작업

- 원본 MP4/MOV/WebM, Vrew WAV/MP3, 원어/한국어/번역 SRT 선택
- 원어 자막을 바탕으로 ChatGPT/Claude용 프롬프트 복사
- OpenAI API를 이용한 자막 인식, 대본 생성, AI 음성 생성 (사용자가 키 입력)
- 일반 대본 또는 `scenes` 편집 JSON, 장면 구간별 속도 조정 (0.25~4배)
- 자막·출처·번역 자막 합성, 원본 소리 제거/12% 믹스, 세로 1080×1920
- 브라우저 IndexedDB에 작업과 미디어 저장/이어 열기 (API 키 제외)
- MediaRecorder MP4 출력, 지원되지 않는 브라우저는 WebM

유튜브 링크는 임베드 미리보기만 지원합니다. 링크 다운로드/자막 서버는 포함하지 않으며 편집에는 원본 파일이 필요합니다. 기기 내 Whisper 자막 인식은 무료이며 모델을 처음 다운로드합니다. OpenAI 인식은 유료 선택 사항입니다. 직접 선택한 SRT/음성으로 제작하면 API 요청을 하지 않습니다.

API 키는 JS 메모리에만 유지됩니다. 자동 생성 버튼이 원어 음성/자막/대본을 OpenAI API로 직접 전송합니다. 원본 파일의 음성 디코딩은 브라우저 코덱 지원에 따라 실패할 수 있습니다. 전송할 WAV는 24MB 이하만 지원합니다. 긴 원본은 짧게 나누거나 기존 SRT를 사용합니다.

영상 출력은 실시간 녹화 방식이므로 탭을 전경에 유지해야 합니다. 재생시간만큼 처리 시간이 필요하며 긴 영상/1080p는 메모리를 많이 사용합니다. Vrew 자막 타임코드는 선택한 음성과 맞아야 합니다. 기본 AI 자막은 문장 길이 기준 초안이고 정밀 맞추기는 추가 음성 인식 요청을 사용합니다.

## 검증

- `node tests/browser-editor.cjs`
- `tests/manual/media-fixture.html`: 3초 합성 MP4/WAV 생성 후 `fixture.srt`와 편집기에 입력 → 영상 만들기 → MP4 저장
- 유료 OpenAI API 실제 호출은 사용자 키가 없어 검증하지 않았습니다.

API 문서: https://developers.openai.com/api/docs/guides/speech-to-text , https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
