import assert from 'node:assert/strict';
import test from 'node:test';

import { internals } from '../index.js';

const {
  originAllowed,
  planActionRefs,
  referencedActions,
  hasActionMarker,
  resolveTitleHandles,
  isMarkerOnlyText,
  installSessionTitles,
  actionInvocationMessage,
} = internals;

function fakeCtx(origin) {
  return { webServer: { getOrigin: () => origin } };
}

test('originAllowed accepts same-origin, no-origin, and same-host requests', () => {
  assert.equal(originAllowed(fakeCtx('http://127.0.0.1:53213'), { headers: {} }), true);
  assert.equal(
    originAllowed(fakeCtx('http://127.0.0.1:53213'), { headers: { origin: 'http://127.0.0.1:53213' } }),
    true,
  );
  assert.equal(
    originAllowed(fakeCtx('http://127.0.0.1:53213/'), { headers: { origin: 'http://127.0.0.1:53213' } }),
    true,
  );
  assert.equal(
    originAllowed(fakeCtx('http://127.0.0.1:53213'), { headers: { origin: 'https://evil.example' } }),
    false,
  );
});

test('originAllowed falls back to the Host header without a live origin', () => {
  const broken = { webServer: { getOrigin: () => { throw new Error('no origin'); } } };
  assert.equal(originAllowed(broken, { headers: { origin: 'http://localhost:1', host: 'localhost:1' } }), true);
  assert.equal(originAllowed(broken, { headers: { origin: 'http://localhost:2', host: 'localhost:1' } }), false);
  assert.equal(originAllowed(broken, { headers: { origin: 'not a url' } }), false);
});

test('planActionRefs mints stable, unique, opaque handles', () => {
  const first = planActionRefs([{ id: 'a', name: '代码审查' }, { id: 'b', name: 'Code Review' }]);
  assert.equal(first.entries.length, 2);
  for (const entry of first.entries) assert.match(entry.name, /^ah-[0-9a-f]{10}$/u);
  assert.notEqual(first.entries[0].name, first.entries[1].name);
  assert.equal(new Set(first.handles.values()).size, 2);
  const renamed = planActionRefs([{ id: 'a', name: 'Renamed entirely' }]);
  assert.equal(renamed.handles.get('a'), first.handles.get('a'));
});

test('referencedActions only scans direct user text and known markers', () => {
  const known = new Set(['ah-0123456789', 'ah-abcdefabcdef']);
  const messages = [
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'please /ah-0123456789 now' }] },
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'again /ah-0123456789' }] },
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'unknown /ah-ffffffffffff' }] },
    { role: 'user', source: { kind: 'skill-invocation' }, content: [{ type: 'text', text: '/ah-abcdefabcdef' }] },
    { role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text: '/ah-abcdefabcdef' }] },
  ];
  assert.deepEqual(referencedActions(messages, known), ['ah-0123456789']);
  assert.deepEqual(referencedActions([
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '/ah-0123456789再测试一下' }] },
  ], known), ['ah-0123456789']);
});

test('referencedActions resolves a marker glued to CJK text', () => {
  const known = new Set(['ah-0123456789']);
  const direct = (text) => [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] }];
  // The chip is often inserted or typed right after Chinese text, with no space.
  assert.deepEqual(referencedActions(direct('请依据/ah-0123456789 这个指令'), known), ['ah-0123456789']);
  assert.deepEqual(referencedActions(direct('测试/ah-0123456789'), known), ['ah-0123456789']);
  // A path or a word keeps the slash spelling as literal text.
  assert.deepEqual(referencedActions(direct('C:/x/ah-0123456789'), known), []);
  assert.deepEqual(referencedActions(direct('v2/ah-0123456789'), known), []);
  assert.equal(hasActionMarker('请依据/ah-0123456789 这个指令'), true);
  assert.equal(hasActionMarker('C:/x/ah-0123456789'), false);
  assert.equal(hasActionMarker('no marker here'), false);
  assert.equal(hasActionMarker(undefined), false);
});

test('actionInvocationMessage wraps the body with the Action name', () => {
  const message = actionInvocationMessage({ name: '代码审查', prompt: 'body\n{{args}}' });
  assert.equal(message.role, 'user');
  assert.equal(message.source.kind, 'action');
  assert.match(message.content[0].text, /^<action_content name="代码审查">/u);
  assert.match(message.content[0].text, /explicitly selected the Action/u);
  assert.match(message.content[0].text, /body/u);
  assert.match(message.content[0].text, /<\/action_content>$/u);
});

test('actionInvocationMessage inlines small resources and lists large paths', () => {
  const message = actionInvocationMessage({ name: 'Deploy', prompt: 'run it' }, {
    basePath: '/data/resources/x',
    files: [
      { name: 'deploy.py', bytes: 5, text: 'print\n' },
      { name: 'big.bin', bytes: 9000, path: '/data/resources/x/big.bin' },
    ],
  });
  const text = message.content[0].text;
  assert.match(text, /<action_resources base="\/data\/resources\/x">/u);
  assert.match(text, /<action_file name="deploy.py">\nprint\n\n<\/action_file>/u);
  assert.match(text, /<action_file name="big.bin" path="\/data\/resources\/x\/big.bin" bytes="9000"\/>/u);
  assert.match(text, /<action_instructions>\nrun it\n<\/action_instructions>/u);
});

test('resolveTitleHandles swaps known Action handles for names', () => {
  const handles = new Map([['ah-da23679f58', 'joke-teller'], ['ah-0123456789', '会话小结']]);
  assert.equal(resolveTitleHandles('/ah-da23679f58', handles), 'joke-teller');
  assert.equal(resolveTitleHandles('Command ah-da23679f58 Request', handles), 'Command joke-teller Request');
  assert.equal(resolveTitleHandles('测试 /ah-da23679f58 一下', handles), '测试 joke-teller 一下');
  assert.equal(resolveTitleHandles('两个 /ah-da23679f58 + /ah-0123456789', handles), '两个 joke-teller + 会话小结');
  // A deleted Action or a path keeps the text untouched.
  assert.equal(resolveTitleHandles('/ah-9999999999', handles), undefined);
  assert.equal(resolveTitleHandles('C:/x/ah-da23679f58', handles), undefined);
  assert.equal(resolveTitleHandles('', handles), undefined);
});

test('isMarkerOnlyText recognises messages that only carry references', () => {
  assert.equal(isMarkerOnlyText('/ah-da23679f58'), true);
  assert.equal(isMarkerOnlyText('  /ah-da23679f58 /ah-0123456789  '), true);
  assert.equal(isMarkerOnlyText('测试 /ah-da23679f58'), false);
  assert.equal(isMarkerOnlyText('no reference'), false);
  assert.equal(isMarkerOnlyText(''), false);
});

function titleHarness() {
  const calls = [];
  const handlers = new Map();
  const timers = [];
  let current;
  const ctx = {
    sessionTitle: {
      get: () => current,
      rename: (session, title) => {
        calls.push({ session: session.id, title });
        current = { title, source: { kind: 'user' } };
      },
    },
    on(event, handler) {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
    effect(fn) {
      const cleanup = fn();
      return () => (typeof cleanup === 'function' ? cleanup() : undefined);
    },
    logger: { warn: () => {} },
  };
  const installed = installSessionTitles(ctx, {}, {
    readActions: async () => [
      { id: 'joke-teller', name: 'joke-teller' },
      { id: 'action-import-assistant', name: 'Action 导入助手' },
    ],
    setTimer: (run) => {
      const timer = { run, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      timer.cleared = true;
    },
    waitMs: 50,
  });
  const emit = async (session, event) => {
    handlers.get('session/event')?.(session, event);
    await new Promise((resolve) => setImmediate(resolve));
  };
  return {
    calls,
    emit,
    timers,
    installed,
    fire() {
      for (const timer of timers.splice(0)) if (!timer.cleared) timer.run();
    },
  };
}

function titleSession(id, text) {
  return {
    id,
    snapshotEvents: () => [{
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text }] },
    }],
  };
}

test('a marker-only first message is titled with the Action name immediately', async () => {
  const harness = titleHarness();
  await harness.emit(titleSession('s1', '/ah-da23679f58'), {
    type: 'session/title',
    data: { title: '/ah-da23679f58', source: { kind: 'fallback' } },
  });
  assert.deepEqual(harness.calls, [{ session: 's1', title: 'joke-teller' }]);
  assert.equal(harness.timers.length, 0);
  harness.installed();
});

test('a mixed message keeps the model title and rewrites the fallback on timeout', async () => {
  const harness = titleHarness();
  const session = titleSession('s2', '请依据/ah-da23679f58 这个指令');
  await harness.emit(session, {
    type: 'session/title',
    data: { title: '请依据/ah-da23679f58 这个指令', source: { kind: 'fallback' } },
  });
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.timers.length, 1);
  harness.fire();
  assert.deepEqual(harness.calls, [{ session: 's2', title: '请依据joke-teller 这个指令' }]);
  harness.installed();
});

test('a provider title is rewritten and cancels the fallback timer', async () => {
  const harness = titleHarness();
  const session = titleSession('s3', '请依据/ah-da23679f58 这个指令');
  await harness.emit(session, {
    type: 'session/title',
    data: { title: '请依据/ah-da23679f58 这个指令', source: { kind: 'fallback' } },
  });
  await harness.emit(session, {
    type: 'session/title',
    data: { title: 'Command ah-da23679f58 Request', source: { kind: 'provider' } },
  });
  assert.deepEqual(harness.calls, [{ session: 's3', title: 'Command joke-teller Request' }]);
  assert.equal(harness.timers[0].cleared, true);
  harness.fire();
  assert.equal(harness.calls.length, 1);
  harness.installed();
});

test('a manual rename cancels the pending fallback rewrite', async () => {
  const harness = titleHarness();
  const session = titleSession('s4', '请依据/ah-da23679f58 这个指令');
  await harness.emit(session, {
    type: 'session/title',
    data: { title: '请依据/ah-da23679f58 这个指令', source: { kind: 'fallback' } },
  });
  await harness.emit(session, {
    type: 'session/title',
    data: { title: '我的标题', source: { kind: 'user' } },
  });
  assert.equal(harness.timers[0].cleared, true);
  harness.fire();
  assert.equal(harness.calls.length, 0);
  harness.installed();
});

test('an unknown handle leaves the title alone', async () => {
  const harness = titleHarness();
  await harness.emit(titleSession('s5', '/ah-ffffffffff'), {
    type: 'session/title',
    data: { title: '/ah-ffffffffff', source: { kind: 'fallback' } },
  });
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.timers.length, 0);
  harness.installed();
});
