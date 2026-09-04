import * as db from '../db.js';
import { parseMessage } from '../parser.js';
import * as ai from '../ai.js';
import { emit } from '../store.js';

let ollamaAvailable = false;
let recognition = null;
let isRecording = false;
let ttsEnabled = true;

export async function render(container) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeech = !!SpeechRec;

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <div>
          <h1>Chat</h1>
          <p id="ai-status"><span class="status-dot offline"></span> Verifica connessione...</p>
        </div>
        <button id="tts-toggle" class="btn-circle btn-circle-sm" title="Attiva/disattiva voce">
          <svg id="tts-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
      </div>
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:var(--space-sm) 0 var(--space-md)"></div>
      <div id="chat-toast" class="chat-toast"></div>
      <div class="chat-input-bar">
        <form id="chat-form" class="chat-form">
          ${hasSpeech ? `
            <button type="button" id="mic-btn" class="btn-circle mic-btn" title="Registra voce">
              <svg id="mic-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          ` : ''}
          <input type="text" id="chat-input" class="chat-input" placeholder="Scrivi qualcosa..." autocomplete="off">
          <button type="submit" class="btn-circle send-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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
    showToast(ttsEnabled ? 'Voce attivata' : 'Voce disattivata');
  });

  if (hasSpeech) {
    const micBtn = document.getElementById('mic-btn');
    setupSpeechRecognition(input, form);
    micBtn.addEventListener('click', toggleRecording);
  }

  const messages = await db.getAll('messages');
  messages.sort((a, b) => a.timestamp - b.timestamp);

  if (messages.length === 0) {
    showSuggestionChips(messagesEl, input, form);
  } else {
    for (const msg of messages) {
      appendMessage(messagesEl, msg);
    }
    scrollToBottom(messagesEl);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    await processMessage(text, messagesEl);
  });

  input.focus();
}

function showToast(text) {
  const toast = document.getElementById('chat-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
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
    sender: 'focus',
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

  try {
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

    recognition.onerror = (event) => {
      stopRecording();
      if (event.error === 'not-allowed') {
        showToast('Permesso microfono negato. Vai in Impostazioni > Safari > Microfono');
      } else if (event.error === 'no-speech') {
        showToast('Nessun audio rilevato, riprova');
      } else if (event.error === 'network') {
        showToast('Errore di rete per il riconoscimento vocale');
      } else {
        showToast('Microfono non disponibile');
      }
    };

    recognition.onend = () => { stopRecording(); };
  } catch (e) {
    recognition = null;
  }
}

function toggleRecording() {
  if (!recognition) {
    showToast('Riconoscimento vocale non supportato su questo dispositivo');
    return;
  }
  if (isRecording) {
    recognition.stop();
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!recognition) {
    showToast('Riconoscimento vocale non disponibile');
    return;
  }
  try {
    isRecording = true;
    const btn = document.getElementById('mic-btn');
    if (btn) {
      btn.classList.add('recording');
    }
    showToast('Sto ascoltando...');
    recognition.start();
  } catch (e) {
    stopRecording();
    if (e.message && e.message.includes('already started')) {
      recognition.stop();
      setTimeout(() => {
        try { recognition.start(); isRecording = true; } catch (_) {
          showToast('Errore avvio microfono');
        }
      }, 200);
    } else {
      showToast('Impossibile avviare il microfono');
    }
  }
}

function stopRecording() {
  isRecording = false;
  const btn = document.getElementById('mic-btn');
  if (btn) {
    btn.classList.remove('recording');
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

function showSuggestionChips(messagesEl, input, form) {
  const suggestions = [
    'latte 2 euro',
    'compra pane e uova',
    'ho speso 30 euro al supermercato',
    'ho il dentista giovedì',
    'ho comprato 3 banane a 1.50 euro',
    'bolletta luce 45 euro'
  ];

  messagesEl.innerHTML = `
    <div class="chat-chips-intro">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--text-muted)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <p>Dimmi cosa hai comprato, cosa devi comprare, o i tuoi impegni</p>
    </div>
    <div class="chat-chips">
      ${suggestions.map(s => `<button class="chat-chip" type="button">${s}</button>`).join('')}
    </div>
  `;

  messagesEl.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.textContent;
      input.focus();
      messagesEl.innerHTML = '';
      form.dispatchEvent(new Event('submit'));
    });
  });
}

function appendMessage(container, msg) {
  const div = document.createElement('div');
  const isUser = msg.sender === 'user';
  div.className = `chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-bot'}`;
  div.textContent = msg.text;
  container.appendChild(div);
}

function appendTyping(container) {
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.className = 'chat-bubble chat-bubble-bot';
  div.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  container.appendChild(div);
}

function removeTyping(container) {
  const el = container.querySelector('#typing-indicator');
  if (el) el.remove();
}

function scrollToBottom(el) {
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}
