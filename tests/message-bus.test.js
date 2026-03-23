import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readdir } from 'fs/promises';
import { resolve } from 'path';
import { FileMessageBus, MemoryMessageBus } from '../scripts/lib/core/message-bus.js';

const TMP_DIR = resolve('.tmp-test-message-bus');

function makeMessageBusTests(name, createBus) {
  describe(`${name}`, () => {
    let bus;

    beforeEach(async () => {
      bus = await createBus();
    });

    afterEach(async () => {
      if (bus.cleanup) await bus.cleanup('test-project');
    });

    it('메시지를 전송하고 수신할 수 있다', async () => {
      await bus.send('cto', 'qa', { type: 'question', content: '테스트 전략은?' });
      const messages = await bus.receive('qa');
      expect(messages.length).toBe(1);
      expect(messages[0].from).toBe('cto');
      expect(messages[0].to).toBe('qa');
      expect(messages[0].content).toBe('테스트 전략은?');
      expect(messages[0].type).toBe('question');
    });

    it('전송 시 고유 ID와 타임스탬프가 생성된다', async () => {
      await bus.send('cto', 'qa', { type: 'question', content: '질문' });
      const messages = await bus.receive('qa');
      expect(messages[0].id).toBeTruthy();
      expect(typeof messages[0].timestamp).toBe('number');
    });

    it('수신자가 없는 메시지는 빈 배열을 반환한다', async () => {
      const messages = await bus.receive('unknown-agent');
      expect(messages).toEqual([]);
    });

    it('broadcast는 모든 에이전트에게 메시지를 전송한다', async () => {
      bus.registerAgents(['cto', 'qa', 'backend']);
      await bus.broadcast('cto', { type: 'fyi', content: '공지사항' });
      const qaMessages = await bus.receive('qa');
      const backendMessages = await bus.receive('backend');
      // 자기 자신에게는 보내지 않음
      const ctoMessages = await bus.receive('cto');
      expect(qaMessages.length).toBe(1);
      expect(backendMessages.length).toBe(1);
      expect(ctoMessages.length).toBe(0);
    });

    it('threadId가 있으면 스레드로 조회할 수 있다', async () => {
      const threadId = 'thread-1';
      await bus.send('cto', 'qa', { type: 'question', content: '질문1', threadId });
      await bus.send('qa', 'cto', { type: 'answer', content: '답변1', threadId });
      const thread = await bus.getThread(threadId);
      expect(thread.length).toBe(2);
      expect(thread[0].content).toBe('질문1');
      expect(thread[1].content).toBe('답변1');
    });

    it('스레드 깊이가 maxThreadDepth를 초과하면 에러를 throw한다', async () => {
      const threadId = 'deep-thread';
      // 5개까지 허용 (maxThreadDepth: 5)
      for (let i = 0; i < 5; i++) {
        await bus.send('cto', 'qa', { type: 'question', content: `msg${i}`, threadId });
      }
      // 6번째는 에러
      await expect(
        bus.send('qa', 'cto', { type: 'answer', content: 'overflow', threadId }),
      ).rejects.toThrow();
    });

    it('maxMessages를 초과하면 에러를 throw한다', async () => {
      // maxMessages: 100 기본값이지만 테스트에서는 작은 값으로 제한
      const smallBus = await createBus({ maxMessages: 3 });
      await smallBus.send('a', 'b', { type: 'fyi', content: 'msg1' });
      await smallBus.send('a', 'b', { type: 'fyi', content: 'msg2' });
      await smallBus.send('a', 'b', { type: 'fyi', content: 'msg3' });
      await expect(smallBus.send('a', 'b', { type: 'fyi', content: 'msg4' })).rejects.toThrow();
    });

    it('cleanup 후 메시지가 모두 삭제된다', async () => {
      await bus.send('cto', 'qa', { type: 'question', content: '질문' });
      await bus.cleanup('test-project');
      const messages = await bus.receive('qa');
      expect(messages).toEqual([]);
    });

    it('markAsRead에 유효하지 않은 messageId를 전달하면 에러가 발생한다', async () => {
      await expect(bus.markAsRead('../traversal')).rejects.toThrow('유효하지 않은 메시지 ID');
      await expect(bus.markAsRead('')).rejects.toThrow('유효하지 않은 메시지 ID');
      await expect(bus.markAsRead(null)).rejects.toThrow('유효하지 않은 메시지 ID');
    });

    it('markAsRead로 메시지를 읽음 처리할 수 있다', async () => {
      await bus.send('cto', 'qa', { type: 'question', content: '질문' });
      const messages = await bus.receive('qa');
      expect(messages[0].read).toBe(false);
      await bus.markAsRead(messages[0].id);
      const updated = await bus.receive('qa', { includeRead: true });
      expect(updated[0].read).toBe(true);
    });

    it('receive는 기본적으로 읽지 않은 메시지만 반환한다', async () => {
      await bus.send('cto', 'qa', { type: 'question', content: '질문1' });
      await bus.send('cto', 'qa', { type: 'question', content: '질문2' });
      const all = await bus.receive('qa');
      expect(all.length).toBe(2);
      // 동일 밀리초에 생성되면 정렬 순서 불안정 → content로 특정
      const msg1 = all.find((m) => m.content === '질문1');
      await bus.markAsRead(msg1.id);
      const unread = await bus.receive('qa');
      expect(unread.length).toBe(1);
      expect(unread[0].content).toBe('질문2');
    });

    it('유효한 type만 허용한다', async () => {
      await expect(bus.send('cto', 'qa', { type: 'invalid', content: 'test' })).rejects.toThrow();
    });

    it('consultation 타입 메시지를 전송할 수 있다', async () => {
      await bus.send('backend', 'security', { type: 'consultation', content: 'JWT vs Session?' });
      const messages = await bus.receive('security');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('consultation');
    });

    it('consultation-reply 타입 메시지를 전송할 수 있다', async () => {
      await bus.send('security', 'backend', {
        type: 'consultation-reply',
        content: 'JWT를 추천합니다',
      });
      const messages = await bus.receive('backend');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('consultation-reply');
    });

    it('Path Traversal을 방어한다', async () => {
      await expect(
        bus.send('cto', '../../../etc', { type: 'fyi', content: 'test' }),
      ).rejects.toThrow('유효하지 않은 에이전트 ID');
    });

    it('빈 에이전트 ID를 거부한다', async () => {
      await expect(bus.send('', 'qa', { type: 'fyi', content: 'test' })).rejects.toThrow(
        '유효하지 않은 에이전트 ID',
      );
    });
  });
}

// --- MemoryMessageBus 테스트 ---
makeMessageBusTests('MemoryMessageBus', async (options) => new MemoryMessageBus(options));

// --- FileMessageBus 테스트 ---
makeMessageBusTests('FileMessageBus', async (options) => {
  await mkdir(TMP_DIR, { recursive: true });
  return new FileMessageBus({ baseDir: TMP_DIR, ...options });
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
});

// --- getStats 테스트 ---
describe('getStats', () => {
  it('MemoryMessageBus: 빈 상태에서 기본 stats를 반환한다', async () => {
    const bus = new MemoryMessageBus();
    const stats = await bus.getStats();
    expect(stats.totalMessages).toBe(0);
    expect(stats.threadCount).toBe(0);
    expect(stats.byType).toEqual({});
    expect(stats.byAgent).toEqual({});
  });

  it('MemoryMessageBus: 다수 메시지 집계', async () => {
    const bus = new MemoryMessageBus();
    await bus.send('cto', 'qa', { type: 'question', content: '질문1', threadId: 't1' });
    await bus.send('qa', 'cto', { type: 'answer', content: '답변1', threadId: 't1' });
    await bus.send('backend', 'security', { type: 'consultation', content: '상담' });
    const stats = await bus.getStats();
    expect(stats.totalMessages).toBe(3);
    expect(stats.threadCount).toBe(1);
    expect(stats.byType.question).toBe(1);
    expect(stats.byType.answer).toBe(1);
    expect(stats.byType.consultation).toBe(1);
    expect(stats.byAgent.cto.sent).toBe(1);
    expect(stats.byAgent.cto.received).toBe(1);
    expect(stats.byAgent.qa.sent).toBe(1);
    expect(stats.byAgent.qa.received).toBe(1);
    expect(stats.byAgent.backend.sent).toBe(1);
    expect(stats.byAgent.security.received).toBe(1);
  });

  it('FileMessageBus: 빈 상태에서 기본 stats를 반환한다', async () => {
    const bus = new FileMessageBus({ baseDir: TMP_DIR });
    const stats = await bus.getStats();
    expect(stats.totalMessages).toBe(0);
    expect(stats.threadCount).toBe(0);
    expect(stats.byType).toEqual({});
    expect(stats.byAgent).toEqual({});
  });

  it('FileMessageBus: 다수 메시지 집계', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const bus = new FileMessageBus({ baseDir: TMP_DIR });
    await bus.send('cto', 'qa', { type: 'question', content: '질문1', threadId: 't1' });
    await bus.send('qa', 'cto', { type: 'answer', content: '답변1', threadId: 't1' });
    await bus.send('backend', 'cto', { type: 'fyi', content: '참고' });
    const stats = await bus.getStats();
    expect(stats.totalMessages).toBe(3);
    expect(stats.threadCount).toBe(1);
    expect(stats.byType.question).toBe(1);
    expect(stats.byType.answer).toBe(1);
    expect(stats.byType.fyi).toBe(1);
    expect(stats.byAgent.cto.sent).toBe(1);
    expect(stats.byAgent.cto.received).toBe(2);
  });
});

// --- FileMessageBus 고유 테스트 ---
describe('FileMessageBus 원자적 쓰기', () => {
  let bus;

  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
    bus = new FileMessageBus({ baseDir: TMP_DIR });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('메시지가 파일로 저장된다', async () => {
    await bus.send('cto', 'qa', { type: 'question', content: 'test' });
    const files = await readdir(resolve(TMP_DIR, 'qa'));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/\.json$/);
  });

  it('임시 파일이 남지 않는다', async () => {
    await bus.send('cto', 'qa', { type: 'question', content: 'test' });
    const files = await readdir(resolve(TMP_DIR, 'qa'));
    const tmpFiles = files.filter((f) => f.startsWith('.tmp-'));
    expect(tmpFiles.length).toBe(0);
  });

  it('손상된 메시지 파일이 있어도 나머지 메시지는 정상 수신된다', async () => {
    const { writeFile } = await import('fs/promises');
    await bus.send('cto', 'qa', { type: 'question', content: '정상 메시지' });
    // 손상된 JSON 파일을 직접 생성
    const qaDir = resolve(TMP_DIR, 'qa');
    await writeFile(resolve(qaDir, '9999999999999-cto-msg-0-bad00000.json'), '{corrupted', 'utf-8');
    const messages = await bus.receive('qa', { includeRead: true });
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('정상 메시지');
  });

  it('markAsRead는 손상된 JSON 파일을 무시한다', async () => {
    const { writeFile } = await import('fs/promises');
    await bus.send('cto', 'qa', { type: 'question', content: 'test' });
    const messages = await bus.receive('qa');
    const msgId = messages[0].id;
    // 메시지 파일을 손상된 JSON으로 덮어쓰기
    const qaDir = resolve(TMP_DIR, 'qa');
    const files = await readdir(qaDir);
    const msgFile = files.find((f) => f.includes(msgId));
    await writeFile(resolve(qaDir, msgFile), '{corrupted json!!!', 'utf-8');
    // markAsRead가 에러 없이 조용히 반환되어야 한다
    await expect(bus.markAsRead(msgId)).resolves.toBeUndefined();
  });
});
