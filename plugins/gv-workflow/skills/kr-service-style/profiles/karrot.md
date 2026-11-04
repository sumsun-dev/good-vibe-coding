# 프로필: 당근식 (`karrot`)

근거는 당근 디자인 시스템 SEED(Apache-2.0)의 공개 문서와 당근 공식 블로그다. 우리 말로 다시 썼다. 출처에 없는 값은 "미확인".

## 원칙

- 프로덕트 디자인 원칙 7개 (항목명만 공개, 설명은 비공개) [C1]: 연결된 경험 · 사용자를 위한 개선 · 직관적인 경험 · **하나의 화면 하나의 목표** · 단순한 시각 요소 · 적절한 피드백 · 간결한 문구
- 말하기 톤은 "활기차고 친절하게". 세 가지 [S1]
  - 명확하게: 결정에 필요한 정보만
  - 쉽게: 누구나 이해하게
  - 사려 깊게: 다양성을 존중하고, 글에 감정이 실린다는 걸 의식한다

## 문구 [S2]

- 익숙한 말. 한자어를 풀어 쓴다 ("불가능합니다" → "할 수 없어요")
- 존칭을 줄인다 ("찾고 계신가요" → "찾고 있나요")
- 숫자는 아라비아 숫자
- 줄임말·은어 금지
- 기능 이름보다 목적을 말한다
- 같은 뜻이면 긍정문, 기본은 능동문
- **"~니다" 는 자동으로 나가는 경고에만**, 나머지는 해요체
- 데이터 변화가 아니라 사용자의 행동을 말한다
- 한 문장에 목적 하나
- 느낌표는 아낀다
- 상태값은 붙여 쓴다 ("예약중")
- 마침표는 평서문에만. **버튼·라벨·20pt 이상 큰 글씨엔 찍지 않는다**
- CTA 는 동사로 시작, **12자 이내** [K1]

## 화면 패턴

- **간격** [S3]: 2px 단위 토큰 2~64px. 화면 좌우 여백 16px, 칩 사이 8px, 화면 하단 56px
- **모서리** [S4]: 2~24px 단계 + 완전 둥글게(9999px). 버튼 완전 둥글게, 카드 12px 단계(r3), 입력창 8px 단계(r2) [K1]
- **글자** [S5]: 11~48px 14단계. iOS·Android·macOS 는 시스템 서체, Windows 는 Pretendard. **한 화면 글자 단계 4개 이내** [K1]
- **카드 안쪽 여백** 최소 16px(x4) [K1]
- **색**: 역할 이름(fg.brand 등)으로 쓴다. 브랜드 주황은 **사용자 브랜드 색으로 바꿔 끼운다** [S6]
- 색 하드코딩 금지 — 토큰으로만 [K1]

## 가져오지 않는 것

- 당근 로고·이름 (Apache-2.0 은 상표권을 주지 않는다) [C2]
- 당근 주황(`#FF6600`, 웹 실측 `#FF6F0F`)을 주색으로 (판단)
- 아이콘 패키지 `@karrotmarket/icon`: 라이선스 미확인 → 쓰지 않는다
- 캐릭터: 정책 미확인 → 쓰지 않는다

## 출처

- [C1] https://careers.daangn.com/blog/post/%EB%8B%B9%EA%B7%BC-%ED%94%84%EB%A1%9C%EB%8D%95%ED%8A%B8-%EB%94%94%EC%9E%90%EC%9D%B4%EB%84%88-8%EB%85%84%EC%B0%A8-%EC%BB%A4%EB%A6%AC%EC%96%B4-%EC%B1%84%EC%9A%A9/
- [C2] https://github.com/daangn/seed-design (LICENSE: Apache-2.0)
- [S1] https://seed-design.io/llms/foundations/voice-and-tone.txt
- [S2] https://seed-design.io/llms/foundations/writing.txt
- [S3] https://seed-design.io/llms/foundations/spacing.txt
- [S4] https://seed-design.io/llms/foundations/radius.txt
- [S5] https://seed-design.io/llms/foundations/typography.txt
- [S6] https://seed-design.io/llms/foundations/color/color-role.txt
- [K1] 당근 Kraft 글: https://medium.com/daangn/%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-%ED%95%9C-%EC%A4%84%EB%A1%9C-%ED%99%94%EB%A9%B4%EC%9D%B4-%EB%82%98%EC%98%A4%EB%8A%94-%EC%8B%9C%EB%8C%80-%EB%8B%B9%EA%B7%BC%EC%8A%A4%EB%9F%AC%EC%9A%B4-%ED%99%94%EB%A9%B4%EC%9D%84-%EB%A7%8C%EB%93%9C%EB%8A%94-%EB%B2%95-0bc268f819c7

확인일: 2026-11-04
