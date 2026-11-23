// Browser voice I/O for KiranaVaani — two engines, one interface:
//   listen() -> Promise<string|null>   next final transcript (null = silence/timeout)
//   speak(text, lang) -> { promise, cancel() }
// The engine is chosen automatically (see sarvam.js resolveVoiceEngine):
// Sarvam (Saaras → Bulbul) when a key is configured, otherwise the free
// Web Speech API. Both implement the same contract, so the voice session
// state machine never knows which one is talking.

import { SARVAM_CONFIG, resolveVoiceEngine } from './sarvam.js';
import { LANGUAGES } from './catalog.js';

export function webSpeechSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    && 'speechSynthesis' in window;
}

export function createVoiceIO({ engine, lang = 'en', rate = 1.0, client = null, speaker = SARVAM_CONFIG.defaultSpeaker } = {}) {
  if (engine === 'sarvam') {
    if (!client) throw new Error('Sarvam engine needs a SarvamClient (and an API key)');
    return new SarvamIO({ client, lang, pace: rate, speaker });
  }
  if (engine === 'webspeech') return new WebSpeechIO({ lang, rate });
  throw new Error(`Unknown voice engine: ${engine}`);
}

// ---------- free fallback: browser Web Speech API ----------

export class WebSpeechIO {
  constructor({ lang = 'en', rate = 1.0 } = {}) {
    this.lang = lang;
    this.rate = rate;
    this._recognition = null;
  }

  listen() {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { resolve(null); return; }
      const rec = new SR();
      this._recognition = rec;
      rec.lang = (LANGUAGES[this.lang] && LANGUAGES[this.lang].code) || 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let done = false;
      let timeout;
      const finish = (value, error) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        try { rec.stop(); } catch (err) { /* already stopped */ }
        if (error) reject(error);
        else resolve(value);
      };
      rec.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        finish(last && last[0] ? last[0].transcript : null);
      };
      rec.onerror = ({ error }) => {
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          finish(null, new DOMException('Microphone permission is unavailable.', 'NotAllowedError'));
        } else if (error === 'audio-capture') {
          finish(null, new DOMException('No microphone was found.', 'NotFoundError'));
        } else finish(null);
      };
      rec.onend = () => finish(null);
      try {
        rec.start();
      } catch (err) {
        finish(null);
        return;
      }
      // Give up after 15 s of silence; the session just listens again.
      if (!done) timeout = setTimeout(() => finish(null), 15000);
    });
  }

  speak(text, lang) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (LANGUAGES[lang] && LANGUAGES[lang].code) || 'en-IN';
    u.rate = this.rate;
    let resolveFn = null;
    const promise = new Promise((resolve) => {
      resolveFn = resolve;
      u.onend = () => resolve('done');
      u.onerror = () => resolve('error');
    });
    try {
      window.speechSynthesis.speak(u);
    } catch (err) {
      if (resolveFn) resolveFn('error');
    }
    return {
      promise,
      cancel: () => {
        try { window.speechSynthesis.cancel(); } catch (err) { /* ignore */ }
        if (resolveFn) resolveFn('cancelled');
      },
    };
  }

  stopListening() {
    try {
      if (this._recognition) this._recognition.abort?.();
    } catch (err) { /* ignore */ }
  }
}

// ---------- primary: Sarvam (Saaras STT -> Bulbul TTS) ----------

export class SarvamIO {
  constructor({ client, lang = 'en', pace = 1.0, speaker = SARVAM_CONFIG.defaultSpeaker } = {}) {
    if (!client) throw new Error('SarvamIO needs a SarvamClient');
    this.client = client;
    this.lang = lang;
    this.pace = pace;
    this.speaker = speaker;
    this._audio = null;
    this._stream = null;
    this._listenToken = 0;
  }

  // Record from the mic until ~1.2 s of silence (or 20 s max), then send the
  // clip to Saaras. Returns the transcript, or null when nothing was said.
  async listen() {
    const token = ++this._listenToken;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (token !== this._listenToken) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    this._stream = stream;
    const mimeType = (typeof MediaRecorder !== 'undefined'
      && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : undefined;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.start(250);
    });
    // Silence detection loop.
    await new Promise((resolve) => {
      let silentMs = 0;
      let heard = false;
      const t0 = Date.now();
      const tick = () => {
        if (token !== this._listenToken) { resolve(); return; }
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 0.02) { heard = true; silentMs = 0; } else { silentMs += 100; }
        if ((heard && silentMs >= 1200) || Date.now() - t0 > 20000) { resolve(); return; }
        setTimeout(tick, 100);
      };
      tick();
    });
    try { recorder.stop(); } catch (err) { /* ignore */ }
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    this._stream = null;
    try { await audioCtx.close(); } catch (err) { /* ignore */ }

    if (token !== this._listenToken) return null;
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    if (!blob.size) return null;
    const { transcript } = await this.client.transcribe({
      audio: blob,
      languageCode: SARVAM_CONFIG.languages[this.lang] || 'en-IN',
    });
    return transcript || null;
  }

  // Bulbul TTS -> play the returned mp3. cancel() stops playback.
  speak(text, lang) {
    let cancelled = false;
    let audio = null;
    let resolveOuter = null;
    const promise = new Promise((resolve) => { resolveOuter = resolve; });
    (async () => {
      try {
        const { audioBase64, codec } = await this.client.synthesize({
          text,
          targetLanguageCode: SARVAM_CONFIG.languages[lang] || 'en-IN',
          speaker: this.speaker,
          pace: this.pace,
        });
        if (cancelled) { resolveOuter('cancelled'); return; }
        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: `audio/${codec || 'mp3'}` });
        audio = new Audio(URL.createObjectURL(blob));
        this._audio = audio;
        audio.onended = () => resolveOuter('done');
        audio.onerror = () => resolveOuter('error');
        await audio.play();
      } catch (err) {
        resolveOuter('error');
      }
    })();
    return {
      promise,
      cancel: () => {
        cancelled = true;
        try { if (audio) audio.pause(); } catch (err) { /* ignore */ }
        if (resolveOuter) resolveOuter('cancelled');
      },
    };
  }

  stopListening() {
    this._listenToken += 1;
    try {
      if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
    } catch (err) { /* ignore */ }
    this._stream = null;
  }
}

export { resolveVoiceEngine };
