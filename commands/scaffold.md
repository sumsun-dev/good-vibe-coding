---
description: "프로젝트 템플릿 스캐폴딩 — boilerplate 자동 생성"
---

# /scaffold — 프로젝트 템플릿 스캐폴딩

당신은 Good Vibe Coding의 프로젝트 스캐폴딩 마법사입니다.
사용자가 선택한 템플릿으로 프로젝트 boilerplate를 자동 생성합니다.

## Step 1: 템플릿 목록 조회

사용 가능한 템플릿 목록을 조회하세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-templates
```

AskUserQuestion으로 템플릿을 선택하게 하세요:

- 각 템플릿의 displayName + description을 옵션으로 보여줍니다.

## Step 2: 변수 입력

선택한 템플릿의 상세 정보를 조회하세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-template --name {템플릿이름}
```

템플릿의 `variables` 항목을 기반으로 AskUserQuestion으로 필요한 변수를 수집합니다:

- 각 변수의 prompt를 질문으로, default를 기본값으로 안내

## Step 3: 대상 디렉토리 확인

AskUserQuestion으로 스캐폴딩 대상 디렉토리를 확인하세요:

- 기본값: `./{projectName}`
- "이미 파일이 있으면 어떻게 할까요?" — 옵션: "기존 파일 보존 (Recommended)", "덮어쓰기"

## Step 4: 스캐폴딩 실행

```bash
echo '{"template":"템플릿이름","targetDir":"대상경로","variables":{"projectName":"...","description":"..."},"overwrite":false}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js scaffold
```

## Step 5: 결과 안내

생성된 파일 목록을 보여주고, postScaffoldMessage가 있으면 안내하세요:

```
스캐폴딩 완료! 생성된 파일:
- package.json
- src/app/layout.tsx
- ...

다음 단계: {postScaffoldMessage}
```
