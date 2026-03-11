/**
 * message-bus — 에이전트 간 비동기 메시지 교환 모듈
 * 파일 기반(FileMessageBus)과 메모리 기반(MemoryMessageBus) 두 구현을 제공한다.
 * 의존성 0, Windows/Linux 호환.
 */

import { writeFile, readFile, readdir, mkdir, rename, rm } from 'fs/promises';
import { resolve, join } from 'path';
import { randomBytes } from 'crypto';
import { config } from './config.js';
import { inputError } from './validators.js';

const VALID_TYPES = new Set([
  'question',
  'answer',
  'clarification',
  'fyi',
  'consultation',
  'consultation-reply',
]);

/** 단조 증가 시퀀스 — 동일 밀리초 내 메시지 순서 보장 */
let _seq = 0;

function generateId() {
  return `msg-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function nextSeq() {
  return ++_seq;
}

const AGENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateAgentId(agentId) {
  if (!agentId || typeof agentId !== 'string' || !AGENT_ID_PATTERN.test(agentId)) {
    throw inputError(`유효하지 않은 에이전트 ID: ${agentId} (영문, 숫자, -, _ 만 허용)`);
  }
}

function validateMessagePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw inputError('메시지 페이로드는 객체여야 합니다');
  }
  if (!VALID_TYPES.has(payload.type)) {
    throw inputError(
      `유효하지 않은 메시지 타입: ${payload.type} (허용: ${[...VALID_TYPES].join(', ')})`,
    );
  }
  if (typeof payload.content !== 'string' || !payload.content.trim()) {
    throw inputError('메시지 content는 비어있지 않은 문자열이어야 합니다');
  }
}

/**
 * 메모리 기반 메시지 버스 (테스트용).
 */
export class MemoryMessageBus {
  constructor(options = {}) {
    this._messages = [];
    this._agents = new Set();
    this._maxMessages = options.maxMessages ?? config.messaging.maxMessages;
    this._maxThreadDepth = options.maxThreadDepth ?? config.messaging.maxThreadDepth;
  }

  registerAgents(agentIds) {
    for (const id of agentIds) this._agents.add(id);
  }

  async send(from, to, payload) {
    validateAgentId(from);
    validateAgentId(to);
    validateMessagePayload(payload);
    if (payload.threadId) {
      const threadMessages = this._messages.filter((m) => m.threadId === payload.threadId);
      if (threadMessages.length >= this._maxThreadDepth) {
        throw inputError(`스레드 깊이 초과: ${payload.threadId} (최대 ${this._maxThreadDepth})`);
      }
    }
    if (this._messages.length >= this._maxMessages) {
      throw inputError(`메시지 수 초과 (최대 ${this._maxMessages})`);
    }
    const message = {
      id: generateId(),
      from,
      to,
      type: payload.type,
      content: payload.content,
      threadId: payload.threadId || null,
      timestamp: Date.now(),
      seq: nextSeq(),
      read: false,
    };
    this._messages.push(message);
    return message;
  }

  async receive(agentId, options = {}) {
    const includeRead = options.includeRead || false;
    return this._messages.filter((m) => m.to === agentId && (includeRead || !m.read));
  }

  async broadcast(from, payload) {
    const targets = [...this._agents].filter((id) => id !== from);
    const results = [];
    for (const to of targets) {
      results.push(await this.send(from, to, payload));
    }
    return results;
  }

  async getThread(threadId) {
    return this._messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.timestamp - b.timestamp || a.seq - b.seq);
  }

  async markAsRead(messageId) {
    const msg = this._messages.find((m) => m.id === messageId);
    if (msg) msg.read = true;
  }

  async getStats() {
    const byType = {};
    const byAgent = {};
    const threadIds = new Set();

    for (const msg of this._messages) {
      byType[msg.type] = (byType[msg.type] || 0) + 1;
      if (msg.threadId) threadIds.add(msg.threadId);

      if (!byAgent[msg.from]) byAgent[msg.from] = { sent: 0, received: 0 };
      byAgent[msg.from].sent++;

      if (!byAgent[msg.to]) byAgent[msg.to] = { sent: 0, received: 0 };
      byAgent[msg.to].received++;
    }

    return {
      totalMessages: this._messages.length,
      threadCount: threadIds.size,
      byType,
      byAgent,
    };
  }

  async cleanup() {
    this._messages = [];
  }
}

/**
 * 파일 기반 메시지 버스 (프로덕션).
 * 저장 경로: {baseDir}/{agentId}/{timestamp}-{from}.json
 * 원자적 쓰기: writeFile(tmp) → rename(tmp, target)
 */
export class FileMessageBus {
  constructor(options = {}) {
    this._baseDir = options.baseDir;
    this._agents = new Set();
    this._maxMessages = options.maxMessages ?? config.messaging.maxMessages;
    this._maxThreadDepth = options.maxThreadDepth ?? config.messaging.maxThreadDepth;
  }

  registerAgents(agentIds) {
    for (const id of agentIds) this._agents.add(id);
  }

  async send(from, to, payload) {
    validateAgentId(from);
    validateAgentId(to);
    validateMessagePayload(payload);

    // 스레드 깊이 체크
    if (payload.threadId) {
      const thread = await this.getThread(payload.threadId);
      if (thread.length >= this._maxThreadDepth) {
        throw inputError(`스레드 깊이 초과: ${payload.threadId} (최대 ${this._maxThreadDepth})`);
      }
    }

    // 총 메시지 수 체크
    const total = await this._countAllMessages();
    if (total >= this._maxMessages) {
      throw inputError(`메시지 수 초과 (최대 ${this._maxMessages})`);
    }

    const message = {
      id: generateId(),
      from,
      to,
      type: payload.type,
      content: payload.content,
      threadId: payload.threadId || null,
      timestamp: Date.now(),
      seq: nextSeq(),
      read: false,
    };

    const agentDir = resolve(this._baseDir, to);
    await mkdir(agentDir, { recursive: true });

    // 원자적 쓰기: tmp → rename
    const fileName = `${message.timestamp}-${from}-${message.id}.json`;
    const tmpPath = join(agentDir, `.tmp-${fileName}`);
    const finalPath = join(agentDir, fileName);
    await writeFile(tmpPath, JSON.stringify(message, null, 2), 'utf-8');
    await rename(tmpPath, finalPath);

    return message;
  }

  async receive(agentId, options = {}) {
    const includeRead = options.includeRead || false;
    const agentDir = resolve(this._baseDir, agentId);
    const messages = await this._readAgentMessages(agentDir);
    return messages.filter((m) => includeRead || !m.read);
  }

  async broadcast(from, payload) {
    const targets = [...this._agents].filter((id) => id !== from);
    const results = [];
    for (const to of targets) {
      results.push(await this.send(from, to, payload));
    }
    return results;
  }

  async getThread(threadId) {
    const allMessages = await this._readAllMessages();
    return allMessages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.timestamp - b.timestamp || (a.seq || 0) - (b.seq || 0));
  }

  async markAsRead(messageId) {
    const allDirs = await this._listAgentDirs();
    for (const dir of allDirs) {
      const messages = await this._readAgentMessages(dir);
      for (const msg of messages) {
        if (msg.id === messageId) {
          msg.read = true;
          const files = await readdir(dir).catch(() => []);
          const file = files.find((f) => f.includes(messageId));
          if (file) {
            await writeFile(join(dir, file), JSON.stringify(msg, null, 2), 'utf-8');
          }
          return;
        }
      }
    }
  }

  async getStats() {
    const allMessages = await this._readAllMessages();
    const byType = {};
    const byAgent = {};
    const threadIds = new Set();

    for (const msg of allMessages) {
      byType[msg.type] = (byType[msg.type] || 0) + 1;
      if (msg.threadId) threadIds.add(msg.threadId);

      if (!byAgent[msg.from]) byAgent[msg.from] = { sent: 0, received: 0 };
      byAgent[msg.from].sent++;

      if (!byAgent[msg.to]) byAgent[msg.to] = { sent: 0, received: 0 };
      byAgent[msg.to].received++;
    }

    return {
      totalMessages: allMessages.length,
      threadCount: threadIds.size,
      byType,
      byAgent,
    };
  }

  async cleanup() {
    await rm(this._baseDir, { recursive: true, force: true });
  }

  async _readAgentMessages(agentDir) {
    try {
      const files = await readdir(agentDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('.tmp-'));
      const messages = [];
      for (const file of jsonFiles) {
        const data = await readFile(join(agentDir, file), 'utf-8');
        messages.push(JSON.parse(data));
      }
      return messages.sort((a, b) => a.timestamp - b.timestamp || (a.seq || 0) - (b.seq || 0));
    } catch {
      return [];
    }
  }

  async _listAgentDirs() {
    try {
      const entries = await readdir(this._baseDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => resolve(this._baseDir, e.name));
    } catch {
      return [];
    }
  }

  async _readAllMessages() {
    const dirs = await this._listAgentDirs();
    const all = [];
    for (const dir of dirs) {
      const messages = await this._readAgentMessages(dir);
      all.push(...messages);
    }
    return all;
  }

  async _countAllMessages() {
    const dirs = await this._listAgentDirs();
    let count = 0;
    for (const dir of dirs) {
      try {
        const files = await readdir(dir);
        count += files.filter((f) => f.endsWith('.json') && !f.startsWith('.tmp-')).length;
      } catch {
        // ignore
      }
    }
    return count;
  }
}
