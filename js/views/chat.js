import * as db from '../db.js';
import { parseMessage } from '../parser.js';
import * as ai from '../ai.js';
import { emit } from '../store.js';

let ollamaAvailable = false;
let recognition = null;
let isRecording = false;
let ttsEnabled = true;

export async function render(container) {
  const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  container.innerHTML = `
    <div class="view-container" style="display:flex;flex-direction:column;height:100%;padding-bottom:0">
      <div class="view-header" style="padding-bottom:var(--space-sm);display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1>Chat</h1>
          <p id="ai-status" style="display:flex;align-items:center;gap:6px"><span class="status-dot offline"></span> Verifica connessione...</p>
        </div>
        <button id="tts-toggle" class="btn btn-ghost btn-icon" style="margin-top:4px" title="Attiva/disattiva voce">
          <svg id="tts-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
      </div>
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:0 0 var(--space-md)"></div>
      <div id="chat-input-area" style="padding:var(--space-sm) 0 var(--space-md);position:sticky;bottom:calc(var(--navbar-height) + var(--safe-bottom))">
        <form id="chat-form" style="display:flex;gap:var(--space-sm);align-items:flex-end">
          ${hasSpeech ? `
            <button type="button" id="mic-btn" class="btn btn-ghost" style="width:48px;height:48px;padding:0;border-radius:var(--radius-full);flex-shrink:0;border:1px solid var(--border)">
              <svg id="mic-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          ` : ''}
          <input type="text" id="chat-input" class="input-field" placeholder="Racconta qualcosa..." autocomplete="off" style="flex:1">
          <button type="submit" class="btn btn-primary" style="width:48px;height:48px;padding:0;border-radius:var(--radius-full);flex-shrink:0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;

  const messagesEl = document.getElementById('chat-messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  checkAiStatus();

  const ttsToggle = document.getElementById('tts-toggle');
  ttsToggle.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    const icon = document.getElementById('tts-icon');
    icon.style.opacity = ttsEnabled ? '1' : '0.3';
  });

  if (hasSpeech) {
    const micBtn = document.getElementById('mic-btn');
    setupSpeechRecognition(input, form);
    micBtn.addEventListener('click', toggleRecording);
  }

  const messages = await db.getAll('messages');
  messages.sort((a, b) => a.timestamp - b.timestamp);
  for (const msg of messages) {
    appendMessage(messagesEl, msg);
  }
  scrollToBottom(messagesEl);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    await processMessage(text, messagesEl);
  });

  input.focus();
}

async function processMessage(text, messagesEl) {
  const userMsg = {
    timestamp: Date.now(),
    text,
    sender: 'user',
    parsed: false,
    actions: []
  };

  const msgId = await db.add('messages', userMsg);
  userMsg.id = msgId;
  appendMessage(messagesEl, userMsg);
  scrollToBottom(messagesEl);

  appendTyping(messagesEl);

  let result;

  if (ollamaAvailable) {
    const aiResult = await ai.chat(text);
    if (aiResult && aiResult.response) {
      result = aiResult;
      await executeAiActions(result.actions || []);
    } else {
      result = await parseMessage(text);
    }
  } else {
    result = await parseMessage(text);
  }

  removeTyping(messagesEl);

  const botMsg = {
    timestamp: Date.now(),
    text: result.response,
    sender: 'nodo',
    parsed: true,
    actions: result.actions || []
  };

  const botId = await db.add('messages', botMsg);
  botMsg.id = botId;
  appendMessage(messagesEl, botMsg);
  scrollToBottom(messagesEl);

  if (ttsEnabled) {
    speak(result.response);
  }

  if (botMsg.actions.length > 0) {
    emit('data-changed', { source: 'chat', actions: botMsg.actions });
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 1.05;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const italian = voices.find(v => v.lang.startsWith('it'));
  if (italian) utterance.voice = italian;

  window.speechSynthesis.speak(utterance);
}

function setupSpeechRecognition(input, form) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'it-IT';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript;

    if (event.results[event.results.length - 1].isFinal) {
      stopRecording();
      if (transcript.trim()) {
        form.dispatchEvent(new Event('submit'));
      }
    }
  };

  recognition.onerror = () => { stopRecording(); };
  recognition.onend = () => { stopRecording(); };
}

function toggleRecording() {
  if (isRecording) {
    recognition.stop();
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!recognition) return;
  isRecording = true;
  const btn = document.getElementById('mic-btn');
  if (btn) {
    btn.style.background = 'var(--danger)';
    btn.style.borderColor = 'var(--danger)';
    btn.style.color = '#fff';
  }
  recognition.start();
}

function stopRecording() {
  isRecording = false;
  const btn = document.getElementById('mic-btn');
  if (btn) {
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

async function checkAiStatus() {
  const statusEl = document.getElementById('ai-status');
  if (!statusEl) return;

  ollamaAvailable = await ai.isAvailable();

  if (ollamaAvailable) {
    const models = await ai.getModels();
    const model = await db.getSetting('ollama_model') || models[0] || 'llama3.2';
    statusEl.innerHTML = `<span class="status-dot online"></span> AI connessa (${model})`;
  } else {
    statusEl.innerHTML = `<span class="status-dot offline"></span> Parser locale attivo`;
  }
}

async function executeAiActions(actions) {
  for (const action of actions) {
    switch (action.type) {
      case 'spesa_add':
        await db.add('spesa', {
          nome: action.item, quantita: action.quantita || null, unita: action.unita || null,
          completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
        });
        break;
      case 'spesa_done':
        await db.add('spesa', {
          nome: action.item, quantita: null, unita: null,
          completato: true, dataAggiunta: new Date().toISOString(), dataCompletato: new Date().toISOString()
        });
        break;
      case 'transazione':
        await db.add('transazioni', {
          importo: action.importo, tipo: 'uscita',
          categoria: action.categoria || 'Altro',
          descrizione: action.descrizione || null,
          data: new Date().toISOString()
        });
        break;
      case 'dispensa_add': {
        const items = await db.getAll('dispensa');
        const found = items.find(i => i.nome.toLowerCase() === action.item.toLowerCase());
        if (found) {
          found.ultimoAcquisto = new Date().toISOString();
          if (action.quantita) found.quantita = (found.quantita || 0) + action.quantita;
          await db.put('dispensa', found);
        } else {
          await db.add('dispensa', {
            nome: action.item, quantita: action.quantita || null, unita: action.unita || null,
            ultimoAcquisto: new Date().toISOString(), consumoMedio: null, stimaEsaurimento: null
          });
        }
        break;
      }
      case 'dispensa_update': {
        const items = await db.getAll('dispensa');
        const found = items.find(i => i.nome.toLowerCase() === action.item.toLowerCase());
        if (found) {
          if (action.quantita !== undefined) found.quantita = action.quantita;
          await db.put('dispensa', found);
        }
        break;
      }
    }
  }
}

function appendMessage(container, msg) {
  const div = document.createElement('div');
  const isUser = msg.sender === 'user';
  div.style.cssText = `
    padding: 10px 14px;
    margin-bottom: 6px;
    border-radius: 18px;
    max-width: 82%;
    line-height: 1.45;
    font-size: var(--font-md);
    animation: fadeIn 0.2s ease-out;
    ${isUser
      ? 'margin-left:auto; background:linear-gradient(135deg, #8b5cf6, #6366f1); color:#fff; border-bottom-right-radius:6px;'
      : 'margin-right:auto; background:var(--bg-card); border:1px solid var(--border-light); border-bottom-left-radius:6px;'}
  `;
  div.textContent = msg.text;
  container.appendChild(div);
}

function appendTyping(container) {
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.style.cssText = `
    padding: 10px 14px;
    margin-bottom: 6px;
    border-radius: 18px;
    max-width: 82%;
    margin-right: auto;
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-bottom-left-radius: 6px;
    color: var(--text-muted);
    font-size: var(--font-sm);
    animation: fadeIn 0.2s ease-out;
  `;
  div.innerHTML = '<span style="animation:pulse 1.5s infinite">Sto pensando...</span>';
  container.appendChild(div);
}

function removeTyping(container) {
  const el = container.querySelector('#typing-indicator');
  if (el) el.remove();
}

function scrollToBottom(el) {
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}
