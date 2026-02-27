/**
 * 테스트용 태스크 출력 fixture
 * 코드 블록을 포함한 다양한 마크다운 출력 샘플
 */

/** 정상적인 단일 파일 출력 */
export const SINGLE_FILE_OUTPUT = `## 구현 결과

\`\`\`javascript src/app.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
\`\`\`

위 코드는 Express 기반의 간단한 서버입니다.`;

/** 다중 파일 출력 */
export const MULTI_FILE_OUTPUT = `## 구현 결과

### 메인 서버
\`\`\`javascript src/server.js
const express = require('express');
const { getUsers } = require('./routes/users');
const app = express();
app.use('/users', getUsers);
module.exports = app;
\`\`\`

### 라우트
\`\`\`javascript src/routes/users.js
function getUsers(req, res) {
  res.json([{ id: 1, name: 'Alice' }]);
}
module.exports = { getUsers };
\`\`\`

### 설정 파일
\`\`\`json package.json
{
  "name": "test-app",
  "version": "1.0.0",
  "main": "src/server.js"
}
\`\`\`

### 테스트
\`\`\`javascript tests/users.test.js
const { getUsers } = require('../src/routes/users');
test('getUsers returns array', () => {
  expect(typeof getUsers).toBe('function');
});
\`\`\``;

/** 텍스트 전용 출력 (코드 블록 없음) */
export const TEXT_ONLY_OUTPUT = `## 아키텍처 분석 결과

### 권장 아키텍처
- 마이크로서비스 패턴
- API Gateway 사용
- JWT 인증

### 성능 고려사항
- Redis 캐싱 권장
- CDN 사용`;

/** 파일명 없는 코드 블록만 포함한 출력 */
export const NO_FILENAME_OUTPUT = `## 코드 예제

다음과 같이 구현할 수 있습니다:

\`\`\`javascript
const result = arr.map(x => x * 2);
\`\`\`

또는 다음 방법도 가능합니다:

\`\`\`javascript
const result = arr.reduce((acc, x) => [...acc, x * 2], []);
\`\`\``;

/** 혼합 출력 (파일명 있는 것 + 없는 것) */
export const MIXED_OUTPUT = `## 구현 결과

### 유틸리티 함수
\`\`\`javascript src/utils/format.js
export function formatDate(date) {
  return date.toISOString().split('T')[0];
}
\`\`\`

사용 예시:

\`\`\`javascript
import { formatDate } from './utils/format';
console.log(formatDate(new Date()));
\`\`\`

### 설정
\`\`\`json config/default.json
{
  "port": 3000,
  "db": "mongodb://localhost/app"
}
\`\`\``;

/** 빌드 에러가 발생하는 코드 출력 */
export const SYNTAX_ERROR_OUTPUT = `## 구현 결과

\`\`\`javascript src/broken.js
const x = {{
  invalid syntax here
\`\`\``;

/** 주석으로 파일명을 지정한 출력 */
export const COMMENT_FILENAME_OUTPUT = `## 구현 결과

\`\`\`javascript
// filename: src/helpers/validator.js
export function validateEmail(email) {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}
\`\`\``;

/** 중첩 디렉토리 구조 출력 */
export const NESTED_DIR_OUTPUT = `## 구현 결과

\`\`\`javascript src/controllers/auth/login.js
export async function login(req, res) {
  const { email, password } = req.body;
  res.json({ token: 'mock-token' });
}
\`\`\`

\`\`\`javascript src/controllers/auth/register.js
export async function register(req, res) {
  const { email, password, name } = req.body;
  res.json({ id: 1, email, name });
}
\`\`\`

\`\`\`javascript src/middleware/auth.js
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
\`\`\``;

/** TDD 스타일 출력 (테스트 + 구현) */
export const TDD_OUTPUT = `## Phase 1: RED - 실패하는 테스트

\`\`\`javascript src/calculator.test.js
import { describe, it, expect } from 'vitest';
import { add, subtract } from './calculator.js';

describe('Calculator', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  it('subtracts two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});
\`\`\`

## Phase 2: GREEN - 최소 구현

\`\`\`javascript src/calculator.js
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}
\`\`\``;
