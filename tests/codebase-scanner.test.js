import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';
import {
  scanCodebase,
  detectTechStack,
  mapTechStackToRoles,
  summarizeFileStructure,
} from '../scripts/lib/project/codebase-scanner.js';

const TMP_DIR = resolve('.tmp-test-codebase-scanner');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

// --- scanCodebase ---

describe('scanCodebase', () => {
  it('Node.js + React 프로젝트를 감지한다', async () => {
    await writeFile(resolve(TMP_DIR, 'package.json'), JSON.stringify({
      dependencies: { react: '18.2.0', express: '4.18.0' },
      devDependencies: { typescript: '5.0.0' },
    }));
    await mkdir(resolve(TMP_DIR, 'src'), { recursive: true });
    await writeFile(resolve(TMP_DIR, 'src', 'app.tsx'), 'export default function App() {}');
    await writeFile(resolve(TMP_DIR, 'src', 'server.js'), 'const express = require("express")');

    const result = await scanCodebase(TMP_DIR);

    expect(result.techStack).toContain('node');
    expect(result.techStack).toContain('react');
    expect(result.techStack).toContain('typescript');
    expect(result.dependencies).toHaveProperty('react', '18.2.0');
    expect(result.dependencies).toHaveProperty('express', '4.18.0');
    expect(result.languages).toHaveProperty('javascript');
    expect(result.scannedAt).toBeDefined();
  });

  it('Python 프로젝트를 감지한다', async () => {
    await writeFile(resolve(TMP_DIR, 'requirements.txt'), 'django==4.2\ncelery==5.3\n');
    await writeFile(resolve(TMP_DIR, 'app.py'), 'from django import setup');

    const result = await scanCodebase(TMP_DIR);

    expect(result.techStack).toContain('python');
    expect(result.techStack).toContain('django');
    expect(result.languages).toHaveProperty('python');
  });

  it('빈 디렉토리를 처리한다', async () => {
    const result = await scanCodebase(TMP_DIR);

    expect(result.techStack).toEqual([]);
    expect(result.languages).toEqual({});
    expect(result.dependencies).toEqual({});
    expect(result.fileStructure).toBe('');
    expect(result.suggestedRoles).toEqual([]);
  });

  it('node_modules, .git 디렉토리를 무시한다', async () => {
    await mkdir(resolve(TMP_DIR, 'node_modules', 'lodash'), { recursive: true });
    await writeFile(resolve(TMP_DIR, 'node_modules', 'lodash', 'index.js'), '');
    await mkdir(resolve(TMP_DIR, '.git', 'objects'), { recursive: true });
    await writeFile(resolve(TMP_DIR, '.git', 'objects', 'abc.js'), '');
    await writeFile(resolve(TMP_DIR, 'index.js'), 'console.log("hi")');

    const result = await scanCodebase(TMP_DIR);

    // node_modules 내 파일은 카운트에 포함되지 않아야 함
    expect(result.languages.javascript).toBe(1);
  });

  it('존재하지 않는 경로에서 AppError를 던진다', async () => {
    await expect(scanCodebase('/nonexistent/path/xyz'))
      .rejects.toThrow();
  });
});

// --- detectTechStack ---

describe('detectTechStack', () => {
  it('package.json에서 React, Express, TypeScript를 감지한다', () => {
    const files = ['src/app.tsx', 'src/server.js'];
    const manifests = {
      'package.json': {
        dependencies: { react: '18.2.0', express: '4.18.0' },
        devDependencies: { typescript: '5.0.0' },
      },
    };

    const result = detectTechStack(files, manifests);

    expect(result.techStack).toContain('node');
    expect(result.techStack).toContain('react');
    expect(result.techStack).toContain('express');
    expect(result.techStack).toContain('typescript');
    expect(result.dependencies).toHaveProperty('react', '18.2.0');
  });

  it('requirements.txt에서 Django를 감지한다', () => {
    const files = ['app.py', 'manage.py'];
    const manifests = {
      'requirements.txt': 'django==4.2\ncelery==5.3\n',
    };

    const result = detectTechStack(files, manifests);

    expect(result.techStack).toContain('python');
    expect(result.techStack).toContain('django');
  });

  it('go.mod에서 Go를 감지한다', () => {
    const files = ['main.go'];
    const manifests = {
      'go.mod': 'module example.com/app\n\ngo 1.21\n',
    };

    const result = detectTechStack(files, manifests);

    expect(result.techStack).toContain('go');
  });

  it('Cargo.toml에서 Rust를 감지한다', () => {
    const files = ['src/main.rs'];
    const manifests = {
      'Cargo.toml': '[package]\nname = "app"\n',
    };

    const result = detectTechStack(files, manifests);

    expect(result.techStack).toContain('rust');
  });

  it('pom.xml에서 Java를 감지한다', () => {
    const files = ['src/Main.java'];
    const manifests = {
      'pom.xml': '<project></project>',
    };

    const result = detectTechStack(files, manifests);

    expect(result.techStack).toContain('java');
  });

  it('빈 입력을 처리한다', () => {
    const result = detectTechStack([], {});

    expect(result.techStack).toEqual([]);
    expect(result.dependencies).toEqual({});
  });
});

// --- mapTechStackToRoles ---

describe('mapTechStackToRoles', () => {
  it('React → frontend 매핑', () => {
    const roles = mapTechStackToRoles(['react', 'node']);
    expect(roles).toContain('frontend');
  });

  it('Express → backend 매핑', () => {
    const roles = mapTechStackToRoles(['express', 'node']);
    expect(roles).toContain('backend');
  });

  it('Django → backend 매핑', () => {
    const roles = mapTechStackToRoles(['django', 'python']);
    expect(roles).toContain('backend');
  });

  it('Docker/Kubernetes → devops 매핑', () => {
    const roles = mapTechStackToRoles(['docker']);
    expect(roles).toContain('devops');
  });

  it('중복 역할을 제거한다', () => {
    const roles = mapTechStackToRoles(['react', 'vue', 'angular']);
    const frontendCount = roles.filter(r => r === 'frontend').length;
    expect(frontendCount).toBe(1);
  });

  it('빈 스택이면 빈 배열', () => {
    expect(mapTechStackToRoles([])).toEqual([]);
  });
});

// --- summarizeFileStructure ---

describe('summarizeFileStructure', () => {
  it('주요 디렉토리별 파일 수를 요약한다', () => {
    const files = ['src/a.js', 'src/b.js', 'tests/c.test.js', 'index.js'];
    const summary = summarizeFileStructure(files);

    expect(summary).toContain('src/');
    expect(summary).toContain('2');
    expect(summary).toContain('tests/');
  });

  it('빈 배열이면 빈 문자열', () => {
    expect(summarizeFileStructure([])).toBe('');
  });
});
