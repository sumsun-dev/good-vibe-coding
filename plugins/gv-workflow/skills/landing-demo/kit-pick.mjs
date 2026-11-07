#!/usr/bin/env node
// Stageshow kit 에서 쓸 부품과 그 의존 파일(.ts·.tsx·.css)만 복사한다.
// 사용: node kit-pick.mjs <원본 kit 폴더> <대상 kit 폴더> <부품 파일...>
// 예:   node kit-pick.mjs ~/bt-skills/stageshow/kit ./components/stageshow/kit stage.tsx phone.tsx motion/Stream.tsx
// 원본의 LICENSE(<kit>/../LICENSE)도 <대상>/../LICENSE 로 복사한다.
// 한계: 정적 import/export 의 상대 경로만 따라간다(확장자 붙인 './x.js', 동적 import(), CSS @import 는 못 봄).
//       Stageshow kit 은 지금 이 형태만 쓴다. 원본 구조가 바뀌면 출력의 "찾지 못함"을 확인한다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const [src, dest, ...entries] = process.argv.slice(2);
if (!src || !dest || entries.length === 0) {
  process.stderr.write('사용: node kit-pick.mjs <원본 kit 폴더> <대상 kit 폴더> <부품 파일...>\n');
  process.exit(2);
}

const resolveSpec = (from, spec) => {
  const base = join(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return normalize(c);
  }
  return null;
};

const seen = new Set();
const missing = [];
const queue = entries.map((e) => normalize(join(src, e)));
const IMPORT = /(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g;

while (queue.length) {
  const file = queue.shift();
  if (seen.has(file)) continue;
  if (!existsSync(file)) {
    missing.push(relative(src, file));
    continue;
  }
  seen.add(file);
  if (!/\.tsx?$/.test(file)) continue;
  for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    const r = resolveSpec(file, m[1] || m[2]);
    if (r) queue.push(r);
    else missing.push(`${relative(src, file)} → ${m[1] || m[2]}`);
  }
}

const files = [...seen].map((f) => relative(src, f)).sort();
if (files.some((f) => f.startsWith('brands/'))) {
  process.stderr.write(
    '경고: brands/(다른 회사 로고, 라이선스 별도)가 딸려 왔습니다. BrandMark·index.ts 를 쓰지 않았는지 확인하세요.\n',
  );
}
for (const f of files) {
  mkdirSync(dirname(join(dest, f)), { recursive: true });
  copyFileSync(join(src, f), join(dest, f));
}
const license = join(src, '..', 'LICENSE');
if (existsSync(license)) {
  mkdirSync(join(dest, '..'), { recursive: true });
  copyFileSync(license, join(dest, '..', 'LICENSE'));
} else {
  missing.push('LICENSE (원본 kit 상위 폴더)');
}
const external = new Set();
for (const f of files.filter((x) => /\.tsx?$/.test(x))) {
  for (const m of readFileSync(join(src, f), 'utf8').matchAll(/from\s*['"]([^.'"][^'"]*)['"]/g)) {
    external.add(m[1]);
  }
}
process.stdout.write(
  `${files.length}개 복사 → ${dest}\n${files.join('\n')}\n외부 패키지: ${[...external].sort().join(', ') || '없음'}\n`,
);
if (missing.length) {
  process.stdout.write(`찾지 못함:\n${missing.join('\n')}\n`);
  process.exit(1);
}
