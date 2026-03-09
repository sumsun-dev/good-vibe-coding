import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..', '..');

describe('SDK .d.ts export 검증', () => {
  let dtsContent;

  it('types/index.d.ts 파일이 존재한다', async () => {
    dtsContent = await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8');
    expect(dtsContent).toBeTruthy();
  });

  it('package.json에 types 필드가 있다', async () => {
    const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.types).toBe('types/index.d.ts');
  });

  it('SDK export와 .d.ts export가 일치한다', async () => {
    const indexSrc = await readFile(resolve(ROOT, 'src', 'index.js'), 'utf-8');
    dtsContent = dtsContent || (await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8'));

    // src/index.js에서 export된 이름 추출
    const srcExports = [];
    for (const m of indexSrc.matchAll(/export\s+\{\s*(\w+)\s*\}/g)) {
      srcExports.push(m[1]);
    }

    // .d.ts에서 export된 클래스/인터페이스/함수 이름 추출
    for (const name of srcExports) {
      expect(dtsContent).toContain(name);
    }
  });

  it('GoodVibe 클래스의 주요 메서드가 정의되어 있다', async () => {
    dtsContent = dtsContent || (await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8'));

    expect(dtsContent).toContain('buildTeam');
    expect(dtsContent).toContain('discuss');
    expect(dtsContent).toContain('execute');
    expect(dtsContent).toContain('executeSteps');
    expect(dtsContent).toContain('report');
  });

  it('ExecuteHooks 인터페이스가 모든 훅을 포함한다', async () => {
    dtsContent = dtsContent || (await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8'));

    expect(dtsContent).toContain('onEscalation');
    expect(dtsContent).toContain('onPhaseComplete');
    expect(dtsContent).toContain('onAgentCall');
    expect(dtsContent).toContain('onCommit');
    expect(dtsContent).toContain('onConfirmPhase');
    expect(dtsContent).toContain('onReviewIntervention');
  });

  it('DiscussHooks 인터페이스가 정의되어 있다', async () => {
    dtsContent = dtsContent || (await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8'));

    expect(dtsContent).toContain('DiscussHooks');
    expect(dtsContent).toContain('onRoundComplete');
    expect(dtsContent).toContain('onAgentCall');
  });

  it('Storage 관련 타입이 정의되어 있다', async () => {
    dtsContent = dtsContent || (await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8'));

    expect(dtsContent).toContain('FileStorage');
    expect(dtsContent).toContain('MemoryStorage');
    expect(dtsContent).toContain('StorageInterface');
  });

  it('Executor, Discusser 클래스가 정의되어 있다', async () => {
    dtsContent = dtsContent || (await readFile(resolve(ROOT, 'types', 'index.d.ts'), 'utf-8'));

    expect(dtsContent).toContain('class Executor');
    expect(dtsContent).toContain('class Discusser');
  });
});
