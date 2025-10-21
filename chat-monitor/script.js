// === 1. Importações e helpers ===
import { ENDPOINT_CONVERSA, ENDPOINT_LOGS, ENDPOINT_SALVAR, ENDPOINT_LIMPAR } from './config.js';

const els = {
  sessionInput: document.getElementById('sessionId'),
  btnLoad: document.getElementById('btnLoad'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnClear: document.getElementById('btnClear'),
  status: document.getElementById('status'),
  messages: document.getElementById('messages'),
  fluxo: document.getElementById('fluxo'),
  btnAgentePrincipal: document.getElementById('btnAgentePrincipal'),
  btnAgenteFinalizador: document.getElementById('btnAgenteFinalizador'),
  // Header actions
  btnVerLogs: document.getElementById('btnVerLogs'),
  btnCopiar: document.getElementById('btnCopiar'),
  btnBaixar: document.getElementById('btnBaixar'),
  btnSalvarDrive: document.getElementById('btnSalvarDrive'),
  btnLimparMemoria: document.getElementById('btnLimparMemoria'),
  // Modal logs
  modalLogs: document.getElementById('modalLogs'),
  fecharModal: document.getElementById('fecharModal'),
  conteudoLogs: document.getElementById('conteudoLogs'),
};

let lastSessionId = localStorage.getItem('cacto:lastSessionId') || '';
let currentMessages = [];
// Buffers de mensagens por agente
let messagesPrincipal = [];
let messagesFinalizador = [];
// Estado do agente selecionado para envio ao backend
let currentAgent = localStorage.getItem('cacto:agente') || 'principal';
if (lastSessionId) {
  els.sessionInput.value = lastSessionId;
}

function setStatus(text, type = 'info') {
  els.status.textContent = text || '';
  els.status.dataset.type = type;
}

function clearMessages() {
  els.messages.innerHTML = '';
  currentMessages = [];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Normaliza papéis vindos do backend para: 'user' | 'agent' | 'system'
function canonicalRoleLower(role) {
  const r = String(role || '').trim().toLowerCase();
  if (!r) return 'system';
  const userSet = new Set([
    'user','usuario','usuário','cliente','human','humano','pessoa','visitante','guest','sender_user'
  ]);
  const agentSet = new Set([
    'agent','agente','assistant','assistente','bot','ia','ai','modelo','principal','finalizador','ux finalizador','ux_finalizador','assistant_finalizador','assistant-principal','system_agent','sender_agent'
  ]);
  const systemSet = new Set(['system','sistema']);
  if (userSet.has(r)) return 'user';
  if (agentSet.has(r)) return 'agent';
  if (systemSet.has(r)) return 'system';
  if (r.includes('assist') || r.includes('agente') || r.includes('bot')) return 'agent';
  if (r.includes('user') || r.includes('usu') || r.includes('client') || r.includes('cliente')) return 'user';
  return 'system';
}

function formatWhatsappMarkup(raw) {
  if (raw == null) return '';
  const text = escapeHtml(String(raw));
  // *bold*, _italic_, ~strike~
  const bold = text.replace(/(^|[\s])\*([^*]+?)\*/g, '$1<b>$2</b>');
  const italic = bold.replace(/(^|[\s])_([^_]+?)_/g, '$1<i>$2</i>');
  const strike = italic.replace(/(^|[\s])~([^~]+?)~/g, '$1<s>$2</s>');
  return strike.replaceAll('\n', '<br>');
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Tenta ler respostas que podem vir vazias ou como texto "[empty]"
async function parseConversaResponse(res) {
  // 204 No Content ou corpo realmente vazio
  if (res.status === 204) return null;

  // Alguns backends retornam content-type incorreto; ler como texto e decidir
  let raw = '';
  try {
    raw = await res.text();
  } catch (_) {
    return null;
  }

  const t = (raw || '').trim();
  if (!t || t === '[empty]' || t.toLowerCase() === 'empty' || t === 'null') {
    return null;
  }

  // Se parecer JSON, tentar parsear; caso contrário, tratar como vazio
  const looksJson = t.startsWith('{') || t.startsWith('[');
  if (looksJson) {
    try {
      return JSON.parse(t);
    } catch (_) {
      return null;
    }
  }

  return null;
}

function normalizeMessages(payload) {
  // === Normaliza para {quem, texto, timestamp}
  if (!payload) return [];
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.messages)
    ? payload.messages
    : Array.isArray(payload?.conversas)
    ? payload.conversas
    : [];

  return arr.map((m) => {
    const quem = canonicalRoleLower(m.quem || m.role || m.sender || m.from || 'system');
    const texto = m.texto ?? m.text ?? m.message ?? m.mensagem ?? '';
    const timestamp = m.timestamp || m.time || m.date || m.created_at || m.createdAt || null;
    return { quem, texto, timestamp };
  });
}

// Construtores/ajudantes para mesclar base (cliente/sistema) com respostas do agente selecionado
function getCanonicalBaseMessages() {
  // SOMENTE MENSAGENS DO CLIENTE devem ficar fixas
  const isUser = (m) => canonicalRoleLower(m.quem || m.role || m.sender) === 'user';
  const baseP = (messagesPrincipal || []).filter(isUser);
  const baseF = (messagesFinalizador || []).filter(isUser);
  // Preferir o conjunto com mais mensagens do cliente; em empate, principal
  return baseP.length >= baseF.length ? baseP : baseF;
}

function getAgentMessagesFrom(agent) {
  const list = agent === 'finalizador' ? (messagesFinalizador || []) : (messagesPrincipal || []);
  return list.filter((m) => canonicalRoleLower(m.quem) === 'agent' && (!m.origin || m.origin === agent));
}

// Mescla preservando a ordem do dataset do agente selecionado.
// Substitui mensagens não-agente desse dataset pela versão canônica (cliente/sistema).
function buildCurrentMessagesForAgent(agent) {
  const baseUsers = getCanonicalBaseMessages(); // apenas mensagens do cliente
  const selected = agent === 'finalizador' ? (messagesFinalizador || []) : (messagesPrincipal || []);
  const out = [];
  let ui = 0; // índice no baseUsers
  for (const m of selected) {
    const role = canonicalRoleLower(m.quem || m.role || m.sender);
    if (role === 'user') {
      // sempre usar a próxima mensagem do cliente a partir da base canônica
      if (ui < baseUsers.length) {
        out.push({ ...baseUsers[ui++] });
      } else {
        // fallback: se acabar a base, ainda mostra o que veio (como user)
        out.push({ ...m, quem: 'user' });
      }
    } else if (role === 'agent') {
      // manter exatamente a resposta do agente selecionado
      out.push({ ...m, quem: 'agent' });
    } else {
      // ignorar 'system' para não poluir a timeline visível
      continue;
    }
  }
  // Se sobrar alguma mensagem do cliente não posicionada (ex.: seleções com menos 'user'), anexa ao final
  while (ui < baseUsers.length) {
    out.push({ ...baseUsers[ui++] });
  }
  // Por segurança, colapsar possíveis blocos consecutivos do agente
  return collapseAgentRuns(out);
}

// Utilitário: remove sequências consecutivas de respostas do agente,
// mantendo apenas a última de cada bloco.
function collapseAgentRuns(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const out = [];
  let bufferAgent = null;
  for (const item of list) {
    const role = canonicalRoleLower(item.quem);
    if (role === 'agent') {
      bufferAgent = { ...item, quem: 'agent' };
      continue;
    }
    // flush agente pendente antes de um user/system
    if (bufferAgent) {
      out.push(bufferAgent);
      bufferAgent = null;
    }
    out.push(item);
  }
  if (bufferAgent) out.push(bufferAgent);
  return out;
}

function renderMessage({ quem, texto, timestamp }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const role = canonicalRoleLower(quem);
  if (role === 'user') {
    wrapper.classList.add('align-right');
    bubble.classList.add('user');
  } else if (role === 'agent') {
    wrapper.classList.add('align-left');
    bubble.classList.add('agent');
  } else {
    wrapper.classList.add('align-center');
    bubble.classList.add('system');
  }

  const content = document.createElement('div');
  content.className = 'content';
  content.innerHTML = formatWhatsappMarkup(texto);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = fmtTime(timestamp);

  bubble.appendChild(content);
  bubble.appendChild(meta);
  wrapper.appendChild(bubble);
  els.messages.appendChild(wrapper);
}
function applyFilterAndRender() {
  els.messages.innerHTML = '';
  currentMessages.forEach(renderMessage);
  scrollToBottom();
}

function scrollToBottom() {
  els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: 'smooth' });
}

// === 2. Funções principais de conversa ===
async function fetchConversa(sessionId) {
  if (!sessionId) {
    setStatus('Informe um session_id para carregar.', 'warn');
    els.sessionInput.focus();
    return;
  }

  setStatus('Carregando conversa…');
  els.btnLoad.disabled = true;
  els.btnRefresh.disabled = true;

  try {
    const fluxo = (els.fluxo?.value || '').trim();
    if (!fluxo) {
      setStatus('Informe o fluxo para carregar a conversa.', 'warn');
      els.fluxo?.focus();
      return;
    }
    const params = new URLSearchParams({ session_id: sessionId });
    if (fluxo) params.set('fluxo', fluxo);

    const urlPrincipal = `${ENDPOINT_CONVERSA}?${params.toString()}&agente=principal`;
    const urlFinalizador = `${ENDPOINT_CONVERSA}?${params.toString()}&agente=finalizador`;

    const [resP, resF] = await Promise.all([
      fetch(urlPrincipal),
      fetch(urlFinalizador)
    ]);

    const dataP = await parseConversaResponse(resP);
    const dataF = await parseConversaResponse(resF);

    messagesPrincipal = normalizeMessages(dataP).map((m) => {
      const role = canonicalRoleLower(m.quem);
      return role === 'agent' ? { ...m, origin: 'principal', quem: 'agent' } : { ...m, quem: role };
    });
    messagesFinalizador = normalizeMessages(dataF).map((m) => {
      const role = canonicalRoleLower(m.quem);
      return role === 'agent' ? { ...m, origin: 'finalizador', quem: 'agent' } : { ...m, quem: role };
    });
    // Colapsar sequências consecutivas de mensagens do mesmo agente em cada conjunto
    messagesPrincipal = collapseAgentRuns(messagesPrincipal);
    messagesFinalizador = collapseAgentRuns(messagesFinalizador);

    // Renderizar combinando mensagens fixas do cliente com respostas do agente selecionado
    currentMessages = buildCurrentMessagesForAgent(currentAgent);
    clearMessages();
    applyFilterAndRender();
    setStatus('Conversa carregada com sucesso.', 'ok');
  } catch (err) {
    console.error(err);
    setStatus(`Falha ao carregar: ${err.message}`, 'error');
  } finally {
    els.btnLoad.disabled = false;
    els.btnRefresh.disabled = false;
  }
}

// === 3. Funções de logs ===
function toggleModal(show) {
  if (show) {
    els.modalLogs.classList.remove('hidden');
    els.modalLogs.setAttribute('aria-hidden', 'false');
  } else {
    els.modalLogs.classList.add('hidden');
    els.modalLogs.setAttribute('aria-hidden', 'true');
  }
}

function renderLogsLegacy(logs) {
  if (!Array.isArray(logs) || !logs.length) {
    els.conteudoLogs.innerHTML = '<div class="log-item">Nenhum log encontrado.</div>';
    return;
  }

  const parts = logs.map((item) => {
    const tool = escapeHtml(item.tool ?? '—');
    const time = item.timestamp ? new Date(item.timestamp) : null;
    const timeStr = time && !isNaN(time.getTime()) ? time.toLocaleString() : escapeHtml(item.timestamp ?? '');
    const entrada = escapeHtml(JSON.stringify(item.entrada ?? {}, null, 2));
    const saida = escapeHtml(JSON.stringify(item.saida ?? {}, null, 2));
    return `
      <div class="log-item">
        <div class="log-header">
          <div class="log-tool">${tool}</div>
          <div class="log-time">${timeStr}</div>
        </div>
        <div>
          <div><b>Entrada</b></div>
          <pre class="log-json">${entrada}</pre>
        </div>
        <div>
          <div><b>Saída</b></div>
          <pre class="log-json">${saida}</pre>
        </div>
      </div>
    `;
  });

  els.conteudoLogs.innerHTML = parts.join('\n');
}

async function verLogs() {
  const id = (els.sessionInput.value || lastSessionId || '').trim();
  if (!id) {
    setStatus('Para ver logs, informe um session_id.', 'warn');
    els.sessionInput.focus();
    return;
  }
  setStatus('Carregando logs…');
  const fluxo = (els.fluxo?.value || '').trim();
  const agente = currentAgent;
  const p1 = new URLSearchParams({ session_id: id });
  if (fluxo) p1.set('fluxo', fluxo);
  if (agente) p1.set('agente', agente);
  const url = `${ENDPOINT_LOGS}?${p1.toString()}`;

  try {
    let data;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (errDireto) {
      console.warn('🔁 Tentando via proxy por CORS...', errDireto);
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const proxied = await fetch(proxyUrl + url, { method: 'GET' });
      if (!proxied.ok) throw new Error(`HTTP ${proxied.status}`);
      data = await proxied.json();
    }

    renderLogs(data);
    toggleModal(true);
    setStatus('Logs carregados.', 'ok');
    console.log('✅ Logs carregados com sucesso');
  } catch (e) {
    console.error('❌ Erro ao buscar logs:', e);
    setStatus(`Falha ao carregar logs: ${e.message}`, 'error');
    alert('Erro ao buscar logs. Tente novamente ou verifique a conexão com o servidor.');
  }
}
async function fetchLogsFor(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return [];
  const fluxo2 = (els.fluxo?.value || '').trim();
  const agente2 = currentAgent;
  const p2 = new URLSearchParams({ session_id: id });
  if (fluxo2) p2.set('fluxo', fluxo2);
  if (agente2) p2.set('agente', agente2);
  const url = `${ENDPOINT_LOGS}?${p2.toString()}`;
  try {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (errDireto) {
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const proxied = await fetch(proxyUrl + url, { method: 'GET' });
      if (!proxied.ok) throw new Error(`HTTP ${proxied.status}`);
      return await proxied.json();
    }
  } catch (e) {
    console.warn('Falha ao buscar logs para salvar:', e);
    return [];
  }
}

// === 4. Funções de exportação ===
const roleLabel = (role) => {
  const r = String(role || '').toLowerCase();
  if (r === 'user') return '**👤 Cliente:**';
  if (r === 'agent') return '**🤖 Agente:**';
  return '**⚙️ Sistema:**';
};

// Versão robusta usando canonicalRoleLower
function roleLabel2(role) {
  const r = canonicalRoleLower(role);
  if (r === 'user') return '**Cliente:**';
  if (r === 'agent') return '**Agente:**';
  return '**Sistema:**';
}

function toMarkdown(messages) {
  if (!Array.isArray(messages) || !messages.length) return '';
  return messages
    .map((m) => `${roleLabel2(m.quem)} ${String(m.texto ?? '').replaceAll('\r', '')}`)
    .join('\n');
}

async function copiarMarkdown() {
  const md = toMarkdown(currentMessages);
  if (!md) {
    setStatus('Nada para copiar. Carregue uma conversa.', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(md);
    setStatus('Markdown copiado para a área de transferência.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Não foi possível copiar. Verifique permissões.', 'error');
  }
}

function baixarMarkdown() {
  const md = toMarkdown(currentMessages);
  if (!md) {
    setStatus('Nada para baixar. Carregue uma conversa.', 'warn');
    return;
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replaceAll(':', '-');
  a.href = url;
  a.download = `conversa_${ts}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus('Arquivo Markdown gerado para download.', 'ok');
}

// === 5. Funções de integração Drive ===
async function salvarNoDrive() {
  const id = (els.sessionInput.value || lastSessionId || '').trim();
  if (!id) {
    setStatus('Para salvar, informe um session_id.', 'warn');
    els.sessionInput.focus();
    return;
  }
  const md = toMarkdown(currentMessages);
  if (!md) {
    setStatus('Nada para salvar. Carregue uma conversa.', 'warn');
    return;
  }
  setStatus('Enviando conversa para o Drive…');
  try {
    const logs = await fetchLogsFor(id);
    const res = await fetch(ENDPOINT_SALVAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id, conteudo_md: md, logs }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus('✅ Conversa salva no Drive com sucesso!', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('❌ Erro ao salvar no Drive.', 'error');
  }
}

// === 6. Eventos e inicialização ===
els.btnLoad.addEventListener('click', () => {
  const id = els.sessionInput.value.trim();
  const fluxo = (els.fluxo?.value || '').trim();
  lastSessionId = id;
  localStorage.setItem('cacto:lastSessionId', id);
  if (!fluxo) {
    setStatus('Informe o fluxo para carregar a conversa.', 'warn');
    els.fluxo?.focus();
    return;
  }
  fetchConversa(id, fluxo);
});

els.btnRefresh.addEventListener('click', () => {
  const id = els.sessionInput.value.trim() || lastSessionId;
  const fluxo = (els.fluxo?.value || '').trim();
  if (!id) {
    setStatus('Nada para atualizar: informe um session_id.', 'warn');
    return;
  }
  if (!fluxo) {
    setStatus('Informe o fluxo para atualizar a conversa.', 'warn');
    els.fluxo?.focus();
    return;
  }
  fetchConversa(id, fluxo);
});

els.btnClear.addEventListener('click', () => {
  clearMessages();
  setStatus('Histórico limpo.', 'ok');
});

els.sessionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    els.btnLoad.click();
  }
});

// Header actions
els.btnVerLogs?.addEventListener('click', verLogs);
els.btnCopiar?.addEventListener('click', copiarMarkdown);
els.btnBaixar?.addEventListener('click', baixarMarkdown);
els.btnSalvarDrive?.addEventListener('click', salvarNoDrive);
els.btnLimparMemoria?.addEventListener('click', limparMemoria);

// Modal controls
els.fecharModal?.addEventListener('click', () => toggleModal(false));
els.modalLogs?.addEventListener('click', (e) => {
  if (e.target === els.modalLogs) toggleModal(false);
});

// Seleção do agente via botões
function updateAgentButtons() {
  els.btnAgentePrincipal?.classList.toggle('primary', currentAgent === 'principal');
  els.btnAgenteFinalizador?.classList.toggle('primary', currentAgent === 'finalizador');
}
updateAgentButtons();
// === Alternância de agentes mantendo mensagens do cliente fixas ===
function renderAgentOnly(agent) {
  const messages = buildCurrentMessagesForAgent(agent);

  els.messages.innerHTML = '';
  messages.forEach(renderMessage);
  scrollToBottom();
}

els.btnAgentePrincipal?.addEventListener('click', () => {
  currentAgent = 'principal';
  localStorage.setItem('cacto:agente', currentAgent);
  updateAgentButtons();
  renderAgentOnly('principal');
});

els.btnAgenteFinalizador?.addEventListener('click', () => {
  currentAgent = 'finalizador';
  localStorage.setItem('cacto:agente', currentAgent);
  updateAgentButtons();
  renderAgentOnly('finalizador');
});


// === 7. Memória: limpar via endpoint ===
// Função antiga (mantida apenas como referência, não utilizada)
/* async function _deprecated_limparMemoria() {
  const id = (els.sessionInput.value || lastSessionId || '').trim();
  if (!id) {
    setStatus('Para limpar memória, informe um session_id.', 'warn');
    els.sessionInput.focus();
    return;
  }
  setStatus('Limpando memória�?�');
  try {
    const res = await fetch(ENDPOINT_LIMPAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus('Memória limpa para este session_id.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus(`Falha ao limpar memória: ${e.message}`, 'error');
  }
} */

// --- Override da renderização de logs com numeração e formatação ---
function renderLogs(raw) {
  console.log('📋 Logs recebidos para renderizar:', raw);

  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!list.length) {
    els.conteudoLogs.innerHTML = '<div class="log-item">Nenhum log encontrado.</div>';
    return;
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return escapeHtml(String(ts));
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const parts = list.map((item, idx) => {
    const numero = `#${idx + 1}`;
    const ferramenta = escapeHtml(item.ferramenta ?? item.tool ?? '—');
    const when = fmtDate(item.timestamp);
    const argumentos = item.argumentos ?? item.entrada ?? {};
    const resultado = item.resultado ?? item.saida ?? {};

    const entradaStr = escapeHtml(JSON.stringify(argumentos ?? {}, null, 2));
    const saidaStr = escapeHtml(JSON.stringify(resultado ?? {}, null, 2));

    return `
      <div class="log-item">
        <div class="log-header">
          <div class="log-num">${numero}</div>
          <div class="log-tool">🛠️ ${ferramenta}</div>
          <div class="log-time">${when}</div>
        </div>
        <div class="log-section">
          <div><b>Entrada</b></div>
          <pre class="code">${entradaStr}</pre>
        </div>
        <div class="log-section">
          <div><b>Saída</b></div>
          <pre class="code">${saidaStr}</pre>
        </div>
      </div>
    `;
  });

  els.conteudoLogs.innerHTML = parts.join('\n');
}

// --- Override limparMemoria com confirmação, envio de fluxo/agente e limpeza local ---
async function limparMemoria() {
  const id = (els.sessionInput.value || lastSessionId || '').trim();
  if (!id) {
    setStatus('Para limpar memória, informe um session_id.', 'warn');
    els.sessionInput.focus();
    return;
  }
  const confirma = window.confirm('Tem certeza que deseja limpar a memória? Esta ação apagará permanentemente os dados desta sessão.');
  if (!confirma) {
    setStatus('Limpeza cancelada.', 'info');
    return;
  }
  setStatus('Limpando memória…');
  try {
    const fluxo = (els.fluxo?.value || '').trim();
    const agente = currentAgent;
    const res = await fetch(ENDPOINT_LIMPAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id, fluxo: fluxo || undefined, agente: agente || undefined }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    clearMessages();
    setStatus('Memória limpa para este session_id.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus(`Falha ao limpar memória: ${e.message}`, 'error');
  }
}
