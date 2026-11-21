// Voice session state machine tests — fake IO, no microphone, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KiranaAgent } from '../src/agent.js';
import {
  VoiceSession, createDemoIO, createSilentIO, runDemoTurns, SESSION_STATES,
} from '../src/session.js';

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// Controllable fake IO: speak stays pending until the test resolves it.
class FakeIO {
  constructor() {
    this.spoken = [];
    this.speakHandle = null;
    this.listenQueue = [];
    this.listenWaiters = [];
  }

  listen() {
    if (this.listenQueue.length) return Promise.resolve(this.listenQueue.shift());
    return new Promise((resolve) => this.listenWaiters.push(resolve));
  }

  deliver(text) {
    if (this.listenWaiters.length) this.listenWaiters.shift()(text);
    else this.listenQueue.push(text);
  }

  speak(text, lang) {
    this.spoken.push({ text, lang });
    let resolveFn;
    let cancelled = false;
    const promise = new Promise((resolve) => { resolveFn = () => resolve(cancelled ? 'cancelled' : 'done'); });
    const handle = {
      promise,
      cancel: () => { cancelled = true; resolveFn(); },
      finish: () => resolveFn(),
      get cancelled() { return cancelled; },
    };
    this.speakHandle = handle;
    return handle;
  }
}

function startSession(io, lang = 'en') {
  const agent = new KiranaAgent();
  const events = [];
  const session = new VoiceSession({ agent, io, lang, onEvent: (e) => events.push(e) });
  return { agent, session, events };
}

test('session states: idle -> listening -> thinking -> speaking -> listening', async () => {
  const io = new FakeIO();
  const { session, events } = startSession(io);
  assert.equal(session.state, 'idle');
  assert.deepEqual(SESSION_STATES, ['idle', 'listening', 'thinking', 'speaking', 'ended']);

  await session.start();
  assert.equal(session.state, 'listening');

  io.deliver('2 kg sugar');
  await tick();
  assert.equal(session.state, 'speaking');
  assert.ok(events.some((e) => e.type === 'state' && e.state === 'thinking'), 'thinking state was visited');
  assert.ok(events.some((e) => e.type === 'state' && e.state === 'listening'), 'listening state was visited');
  assert.equal(io.spoken.length, 1);
  assert.ok(/sugar/i.test(io.spoken[0].text), io.spoken[0].text);

  io.speakHandle.finish();
  await tick();
  assert.equal(session.state, 'listening');
  assert.ok(events.some((e) => e.type === 'user-turn'));
  assert.ok(events.some((e) => e.type === 'agent-turn'));
  await session.end();
});

test('continuous turn-taking: two orders in one session, bill accumulates', async () => {
  const io = new FakeIO();
  const { agent, session } = startSession(io);
  await session.start();
  io.deliver('2 kg sugar');
  await tick(20);
  io.speakHandle.finish();
  await tick(20);
  io.deliver('1 kg rice');
  await tick(20);
  io.speakHandle.finish();
  await tick(20);
  assert.equal(agent.total, 152); // 90 + 62
  assert.equal(session.transcript.length, 4);
  assert.equal(session.state, 'listening');
  await session.end();
});

test('barge-in: speaking over the agent cancels its reply and takes the new turn', async () => {
  const io = new FakeIO();
  const { agent, session, events } = startSession(io);
  await session.start();
  io.deliver('2 kg sugar');
  await tick(20);
  assert.equal(session.state, 'speaking');
  const firstSpeak = io.speakHandle;
  assert.equal(firstSpeak.cancelled, false);

  // Customer interrupts mid-speech with the next order.
  io.deliver('bill');
  await tick(20);
  assert.equal(firstSpeak.cancelled, true);
  assert.equal(session.bargeIns, 1);
  assert.ok(events.some((e) => e.type === 'barge-in'));
  // The bill turn was processed (and spoken) after the interruption.
  await tick(20);
  assert.ok(io.spoken.some((s) => /90/.test(s.text) || /bill/i.test(s.text)));
  io.speakHandle.finish();
  await tick(20);
  assert.equal(session.state, 'listening');
  await session.end();
});

test('interrupt() button: stops speech and returns to listening', async () => {
  const io = new FakeIO();
  const { session } = startSession(io);
  await session.start();
  io.deliver('2 kg sugar');
  await tick(20);
  assert.equal(session.state, 'speaking');
  assert.equal(session.interrupt(), true);
  await tick(20);
  assert.equal(session.state, 'listening');
  assert.equal(session.bargeIns, 1);
  assert.equal(session.interrupt(), false); // nothing to interrupt now
  await session.end();
});

test('end() returns a session summary with items, total and signals', async () => {
  const io = new FakeIO();
  const { agent, session } = startSession(io);
  await session.start();
  io.deliver('basmati rice 2 kg');
  await tick(20);
  io.speakHandle.finish();
  await tick(20);
  io.deliver('yes');
  await tick(20);
  io.speakHandle.finish();
  await tick(20);
  const summary = await session.end();
  assert.equal(session.state, 'ended');
  assert.equal(summary.total, 124); // ponni substitute
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0].itemId, 'rice-ponni');
  assert.equal(summary.signals.length, 1);
  assert.equal(summary.signals[0].itemId, 'rice-basmati');
  assert.equal(summary.userTurns, 2);
  assert.equal(summary.agentTurns, 2);
  assert.ok(summary.durationMs >= 0);
  assert.ok(summary.startedAt && summary.endedAt);
  // Ended sessions ignore further turns.
  assert.equal(session.receive('2 kg sugar'), false);
  assert.equal(agent.total, 124);
});

test('receive() before start and after end is ignored', async () => {
  const io = new FakeIO();
  const { session } = startSession(io);
  assert.equal(session.receive('2 kg sugar'), false);
  await session.start();
  await session.end();
  assert.equal(session.receive('2 kg sugar'), false);
});

test('listen() errors do not kill the session', async () => {
  const io = new FakeIO();
  io.listen = async () => { throw new Error('mic denied'); };
  const { session, events } = startSession(io);
  await session.start();
  await tick(700); // a couple of error/backoff cycles
  assert.equal(session.state, 'listening');
  assert.ok(events.some((e) => e.type === 'listen-error'));
  await session.end();
});

test('demo driver: scripted Tamil order runs end-to-end through the session', async () => {
  const agent = new KiranaAgent();
  const events = [];
  const session = new VoiceSession({
    agent,
    io: createDemoIO({ minMs: 5, maxMs: 10, charsPerMs: 1 }),
    lang: 'ta',
    onEvent: (e) => events.push(e),
  });
  await session.start();
  await runDemoTurns(session, [
    'ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?',
    'பாஸ்மதி அரிசி 2 கிலோ',
    'சரி',
    '2 கிலோ சர்க்கரை',
    'பில்',
  ], { delay: 5 });
  // Let the last speak finish.
  await tick(120);
  assert.equal(agent.total, 489); // 275 atta + 124 ponni + 90 sugar (2kg @ 45, base catalogue)
  assert.equal(agent.lines.length, 3);
  assert.equal(agent.signals.length, 1); // basmati
  assert.ok(events.some((e) => e.type === 'agent-turn' && /489/.test(e.turn.text)));
  const summary = await session.end();
  assert.equal(summary.total, 489);
  assert.equal(summary.userTurns, 5);
});

test('silent IO: typed fallback drives the same machine', async () => {
  const agent = new KiranaAgent();
  const session = new VoiceSession({ agent, io: createSilentIO(), lang: 'en' });
  await session.start();
  session.receive('2 kg sugar');
  await tick(20);
  assert.equal(agent.total, 90);
  assert.equal(session.state, 'listening');
  await session.end();
});
