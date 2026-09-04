import * as db from '../db.js';
import { parseMessage } from '../parser.js';
import { emit } from '../store.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view-container" style="display:flex;flex-direction:column;height:100%;padding-bottom:0">
      <div class="view-header">
        <h1>Chat</h1>
        <p id="ai-status">Parser locale attivo</p>
      </div>
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding-bottom:var(--space-md)"></div>
      <div id="chat-input-area" style="padding:var(--space-sm) 0 var(--space-md);position:sticky;bottom:calc(var(--navbar-height) + var(--safe-bottom))">
        <form id="chat-form" style="display:flex;gap:var(--space-sm)">
          <input type="text" id="chat-input" class="input-field" placeholder="Racconta qualcosa..." autocomplete="off" style="flex:1">
          <button type="submit" class="btn btn-primary btn-icon" style="width:44px;height:44px;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;

  const messagesEl = document.getElementById('chat-messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

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

    const result = await parseMessage(text);

    const botMsg = {
      timestamp: Date.now(),
      text: result.response,
      sender: 'nodo',
      parsed: true,
      actions: result.actions
    };

    const botId = await db.add('messages', botMsg);
    botMsg.id = botId;
    appendMessage(messagesEl, botMsg);
    scrollToBottom(messagesEl);

    if (result.actions.length > 0) {
      emit('data-changed', { source: 'chat', actions: result.actions });
    }
  });

  input.focus();
}

function appendMessage(container, msg) {
  const div = document.createElement('div');
  div.style.cssText = `
    padding: var(--space-sm) var(--space-md);
    margin-bottom: var(--space-xs);
    border-radius: var(--radius-md);
    max-width: 85%;
    ${msg.sender === 'user'
      ? 'margin-left:auto; background:var(--accent); color:#fff;'
      : 'margin-right:auto; background:var(--bg-card); border:1px solid var(--border-light);'}
  `;
  div.textContent = msg.text;
  container.appendChild(div);
}

function scrollToBottom(el) {
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}
