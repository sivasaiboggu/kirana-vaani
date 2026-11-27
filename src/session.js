// Voice session state machine for KiranaVaani.
// Pure logic — no DOM, no Web Speech API here — so the SAME machine drives
// the real voice path, the typed fallback and the scripted demo, and the
// Node test suite can drive it with a fake IO.
//
// States: idle -> listening -> thinking -> speaking -> listening -> ... -> ended
//   listening: waiting for the customer to speak
//   thinking:  a turn arrived, the agent is working out the reply
//   speaking:  the agent is speaking its reply out loud
//   ended:     the session is over; summary() describes what happened
//
// Turn-taking is continuous: when the agent finishes speaking it goes back
// to listening automatically — the customer never taps the mic per turn.
// Barge-in: if a customer utterance arrives while the agent is speaking,
// the spoken reply is cancelled and the new turn is processed instead.

export const SESSION_STATES = ['idle', 'listening', 'thinking', 'speaking', 'ended'];

export const STATE_LABELS = {
  idle: 'Idle',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  ended: 'Session ended',
};

// IO contract (injected so tests can fake it):
//   listen() -> Promise<string|null>   next final transcript, or null on silence/timeout
//   speak(text, lang) -> { promise, cancel() }   promise resolves when speech ends or is cancelled
export class VoiceSession {
  constructor({ agent, io, lang = 'en', respond = null, onEvent = () => {}, shouldReviewVoice = () => false } = {}) {
    if (!agent) throw new Error('VoiceSession needs a KiranaAgent');
    if (!io) throw new Error('VoiceSession needs an IO (listen/speak)');
    this.agent = agent;
    this.io = io;
    this.lang = lang;
    // respond(text, lang) -> agent.process-shaped result. Defaults to the
    // local rules engine; the Sarvam path passes a responder that tries
    // sarvam-105b first and falls back to this same local engine.
    this.respond = respond || ((text, l) => agent.process(text, l));
    this.onEvent = onEvent;
    this.shouldReviewVoice = shouldReviewVoice;
    this.state = 'idle';
    this.transcript = []; // { who: 'user'|'agent', text, lang, at, action? }
    this.startedAt = null;
    this.endedAt = null;
    this.bargeIns = 0;
    this._token = 0;
    this._speakHandle = null;
    this._turnQueue = [];
    this._pumping = false;
    this._listening = false;
    this._voicePaused = false;
    this._voiceEpoch = 0;
  }

  get elapsedMs() {
    if (!this.startedAt) return 0;
    return (this.endedAt || Date.now()) - this.startedAt;
  }

  get active() {
    return this.state !== 'idle' && this.state !== 'ended';
  }

  get canFinish() {
    return this.active && this.state !== 'thinking' && this._turnQueue.length === 0;
  }

  pauseVoice() {
    this._voicePaused = true;
    this._voiceEpoch += 1;
    this.io.stopListening?.();
  }

  resumeVoice() {
    if (!this.active || !this._voicePaused) return;
    this._voicePaused = false;
    this._listenLoop(this._token);
  }

  changeIO(io) {
    this.io.stopListening?.();
    this.io = io;
    this._listenLoop(this._token);
  }

  _setState(next) {
    this.state = next;
    this.onEvent({ type: 'state', state: next, label: STATE_LABELS[next] });
  }

  async start() {
    if (this.state !== 'idle') return false;
    this.startedAt = Date.now();
    this._token += 1;
    const token = this._token;
    this._setState('listening');
    this._listenLoop(token); // fire-and-forget; runs until end()
    return true;
  }

  async _listenLoop(token) {
    if (this._listening) return;
    this._listening = true;
    try {
      while (token === this._token && !this._voicePaused && this.state !== 'ended') {
        let text = null;
        const io = this.io;
        const epoch = this._voiceEpoch;
        try {
          text = await io.listen();
        } catch (err) {
          if (token !== this._token || this._voicePaused) break;
          const voiceUnavailable = ['NotAllowedError', 'NotFoundError', 'ServiceNotAllowedError'].includes(err?.name);
          if (voiceUnavailable) this.pauseVoice();
          this.onEvent({ type: 'listen-error', error: String((err && err.message) || err), voiceUnavailable });
          // back off a little so a broken mic does not spin the loop hot
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        if (token !== this._token || this._voicePaused || this.state === 'ended') break;
        if (text == null || !String(text).trim()) continue; // silence/timeout — keep listening
        if (io !== this.io || epoch !== this._voiceEpoch) continue;
        const clean = String(text).trim();
        if (this.shouldReviewVoice()) {
          this.pauseVoice();
          this.onEvent({ type: 'voice-draft', text: clean });
        } else this.receive(clean);
      }
    } finally {
      this._listening = false;
    }
  }

  // Entry point for a customer utterance — from the mic, the demo driver or
  // the typed box. Safe to call while the agent is speaking: that is
  // barge-in, and the spoken reply is cancelled.
  receive(text) {
    const clean = String(text || '').trim();
    if (!clean || this.state === 'ended' || this.state === 'idle') return false;
    if (this.state === 'speaking' && this._speakHandle) {
      this.bargeIns += 1;
      this.onEvent({ type: 'barge-in', text: clean, count: this.bargeIns });
      try { this._speakHandle.cancel(); } catch (err) { /* already finished */ }
      this._speakHandle = null;
    }
    this._turnQueue.push(clean);
    this._pumpTurns();
    return true;
  }

  async _pumpTurns() {
    if (this._pumping) return;
    this._pumping = true;
    try {
      while (this._turnQueue.length > 0 && this.state !== 'ended') {
        const text = this._turnQueue.shift();
        await this._processTurn(text);
      }
    } finally {
      this._pumping = false;
    }
  }

  async _processTurn(text) {
    const token = this._token;
    this._setState('thinking');
    const userTurn = { who: 'user', text, lang: this.lang, at: new Date().toISOString() };
    this.transcript.push(userTurn);
    this.onEvent({ type: 'user-turn', turn: userTurn });

    const isCurrent = () => token === this._token && this.state !== 'ended';
    let result;
    try {
      result = await this.respond(text, this.lang, isCurrent);
    } catch (err) {
      // Last-resort fallback: the local rules engine never needs a network.
      if (!isCurrent()) return;
      result = this.agent.process(text, this.lang);
    }
    if (token !== this._token || this.state === 'ended') return;
    if (result && result.lang) this.lang = result.lang;

    const agentTurn = {
      who: 'agent',
      text: (result && result.reply) || '',
      lang: (result && result.lang) || this.lang,
      at: new Date().toISOString(),
      action: (result && result.action) || null,
    };
    this.transcript.push(agentTurn);
    this.onEvent({ type: 'agent-turn', turn: agentTurn, result });

    this._setState('speaking');
    const handle = this.io.speak(agentTurn.text, agentTurn.lang);
    this._speakHandle = handle;
    try { await handle.promise; } catch (err) { /* cancelled or failed — carry on */ }
    if (token !== this._token || this.state === 'ended') return;
    this._speakHandle = null;
    // Continuous turn-taking: back to listening automatically.
    this._setState('listening');
  }

  // "Interrupt" button: stop the agent mid-sentence and go back to listening.
  interrupt() {
    if (this.state !== 'speaking' || !this._speakHandle) return false;
    this.bargeIns += 1;
    this.onEvent({ type: 'barge-in', text: null, count: this.bargeIns });
    try { this._speakHandle.cancel(); } catch (err) { /* already finished */ }
    this._speakHandle = null;
    this._setState('listening');
    return true;
  }

  async end() {
    if (this.state === 'idle') return this.summary();
    if (this.state === 'ended') return this.summary();
    this._token += 1;
    this.pauseVoice();
    if (this._speakHandle) {
      try { this._speakHandle.cancel(); } catch (err) { /* already finished */ }
      this._speakHandle = null;
    }
    this._turnQueue = [];
    this.endedAt = Date.now();
    this._setState('ended');
    const summary = this.summary();
    this.onEvent({ type: 'summary', summary });
    return summary;
  }

  summary() {
    const items = this.agent.lines.map((l) => ({
      itemId: l.item.id,
      name: l.item.names.en,
      qty: l.qty,
      unit: l.item.unit,
      price: l.item.price,
      total: l.total,
    }));
    return {
      lang: this.lang,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      endedAt: this.endedAt ? new Date(this.endedAt).toISOString() : null,
      durationMs: this.elapsedMs,
      turns: this.transcript.length,
      userTurns: this.transcript.filter((t) => t.who === 'user').length,
      agentTurns: this.transcript.filter((t) => t.who === 'agent').length,
      bargeIns: this.bargeIns,
      items,
      total: this.agent.total,
      signals: this.agent.signals.map((s) => ({ ...s })),
    };
  }
}

// Demo driver — feeds scripted turns through the same state machine, so the
// demo exercises the exact turn-taking / barge-in / summary path as live voice.
// A turn is only sent once the agent is listening again: a real customer
// waits for the agent to finish speaking, and sending a turn mid-reply is
// a barge-in — the old driver sent every 150 ms in fast mode, so every
// demo receipt recorded 5 interruptions that never happened.
export async function runDemoTurns(session, steps, { delay = 1100 } = {}) {
  for (const step of steps) {
    await waitForListening(session);
    if (session.state === 'ended') break;
    await new Promise((r) => setTimeout(r, delay));
    if (session.state === 'ended') break;
    session.receive(step);
  }
}

// Poll until the session is back to listening (or ended), so the next turn
// does not interrupt the reply in progress. Gives up after a timeout so a
// stuck speak can never hang the demo forever.
async function waitForListening(session, timeoutMs = 15000) {
  const start = Date.now();
  while (session.state !== 'listening' && session.state !== 'ended') {
    if (Date.now() - start > timeoutMs) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Demo IO: speak is simulated (resolves after a delay proportional to reply
// length) and listen never resolves — the driver feeds the turns. Used for
// ?demo=… and for headless renders, where there is no microphone.
export function createDemoIO({ charsPerMs = 14, minMs = 350, maxMs = 2600 } = {}) {
  return {
    listen: () => new Promise(() => {}),
    speak: (text) => {
      const ms = Math.min(maxMs, Math.max(minMs, String(text).length * charsPerMs));
      let timer = null;
      let resolveFn = null;
      const promise = new Promise((resolve) => {
        resolveFn = resolve;
        timer = setTimeout(() => resolve('done'), ms);
      });
      return {
        promise,
        cancel: () => {
          if (timer) clearTimeout(timer);
          if (resolveFn) resolveFn('cancelled');
        },
      };
    },
  };
}

// Silent IO: for the typed fallback — turns arrive from the text box, speech
// resolves immediately (nothing is spoken out loud).
export function createSilentIO() {
  let finish;
  return {
    listen: () => new Promise((resolve) => { finish = resolve; }),
    stopListening: () => finish?.(null),
    speak: () => ({ promise: Promise.resolve('done'), cancel: () => {} }),
  };
}
