// Editor de Prompt: carregar e salvar prompts + criar agente + buscar agentes
import { API_BASE_URL, ENDPOINT_PROMPT_CARREGAR, ENDPOINT_PROMPT_SALVAR, ENDPOINT_CRIAR_AGENTE, ENDPOINT_AGENTES_CARREGAR, ENDPOINT_PROMPT_ATIVAR, ENDPOINT_LIMPAR } from './config.js';

const els = {
  // editor
  prompt: document.getElementById('promptInput'),
  promptLineCount: document.getElementById('promptLineCount'),
  status: document.getElementById('status'),
  // header
  btnCopiar: document.getElementById('btnCopiar'),
  btnBaixar: document.getElementById('btnBaixar'),
  btnLimparMemoria: document.getElementById('btnLimparMemoria'),
  // centro (caso exista na página)
  btnCopyCenter: document.getElementById('btnCopyCenter'),
  btnDownloadCenter: document.getElementById('btnDownloadCenter'),
  // simples: fluxo/agente/versão
  inputFluxo: document.getElementById('inputFluxo'),
  inputAgente: document.getElementById('inputAgente'),
  inputVersao: document.getElementById('inputVersao'),
  btnCarregarPrompt: document.getElementById('btnCarregarPrompt'),
  // salvar
  btnSalvarPrompt: document.getElementById('btnSalvarPromptMain') || document.getElementById('btnSalvarPrompt'),
  btnSalvarComoNovo: document.getElementById('btnSalvarComoNovo'),
  btnBuscarPrompts: document.getElementById('btnBuscarPrompts'),
  chkAtivo: document.getElementById('chkAtivo'),
  // modal salvar como novo
  modalSalvarComoNovo: document.getElementById('modalSalvarComoNovo'),
  fecharModalSalvarComoNovo: document.getElementById('fecharModalSalvarComoNovo'),
  novoAgenteNome: document.getElementById('novoAgenteNome'),
  novoAgenteVersao: document.getElementById('novoAgenteVersao'),
  btnSalvarComoNovoConfirm: document.getElementById('btnSalvarComoNovoConfirm'),
  // criar agente (modal)
  btnAbrirCriarAgente: document.getElementById('btnAbrirCriarAgente'),
  modalCriarAgente: document.getElementById('modalCriarAgente'),
  fecharModalCriar: document.getElementById('fecharModalCriar'),
  novoBase: document.getElementById('novoBase'),
  novoVersao: document.getElementById('novoVersao'),
  novoDescricao: document.getElementById('novoDescricao'),
  novoPrompt: document.getElementById('novoPrompt'),
  novoAtivo: document.getElementById('novoAtivo'),
  novoPreview: document.getElementById('novoPreview'),
  btnCriarAgenteConfirm: document.getElementById('btnCriarAgenteConfirm'),
  // selecionar/buscar agentes (modal)
  modalAgente: document.getElementById('modalAgente'),
  fecharModalAgente: document.getElementById('fecharModalAgente'),
  agenteFluxo: document.getElementById('agenteFluxo'),
  agenteBase: document.getElementById('agenteBase'),
  agenteAtivoOnly: document.getElementById('agenteAtivoOnly'),
  btnBuscarAgente: document.getElementById('btnBuscarAgente'),
  agenteResultados: document.getElementById('agenteResultados'),
  btnConfirmarAgente: document.getElementById('btnConfirmarAgente'),
  promptAtivoStatus: document.getElementById('promptAtivoStatus'),
  promptAtualizadoEm: document.getElementById('promptAtualizadoEm'),
};

// Ajusta rótulos do modal para Fluxo/Agente
try {
  const lblBase = document.querySelector('label[for="novoBase"]');
  if (lblBase) lblBase.textContent = 'Fluxo';
  const lblDesc = document.querySelector('label[for="novoDescricao"]');
  if (lblDesc) lblDesc.textContent = 'Agente';
} catch {}

function setStatus(text, type = 'info') {
  if (!els.status) return;
  els.status.textContent = text || '';
  els.status.dataset.type = type;
}

// Limpar memória via endpoint compartilhado com o Chat Monitor
async function limparMemoria() {
  const confirma = window.confirm('Tem certeza que deseja limpar toda a memória de chat? Esta ação é permanente.');
  if (!confirma) {
    setStatus('Limpeza cancelada.', 'info');
    return;
  }
  setStatus('Limpando memória…');
  try {
    const res = await fetch(ENDPOINT_LIMPAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    setStatus('Memória de chat limpa.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Falha ao limpar memória: ' + e.message, 'error');
  }
}
function updateLineCount() {
  const text = els.prompt?.value || '';
  const lines = text.length ? text.split(/\r?\n/).length : 0;
  if (els.promptLineCount) {
    els.promptLineCount.textContent = `${lines} ${lines === 1 ? 'linha' : 'linhas'}`;
  }
}

function openModal(el, open = true) {
  if (!el) return;
  if (open) {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    try { el.style.display = 'grid'; } catch {}
  } else {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    try { el.style.display = 'none'; } catch {}
  }
}

function updateAtivoIndicator(ativo) {
  if (!els.promptAtivoStatus) return;
  const el = els.promptAtivoStatus;
  if (typeof ativo === 'boolean') {
    el.textContent = ativo ? 'Ativo' : 'Inativo';
    el.classList.toggle('active', ativo);
    el.classList.toggle('inactive', !ativo);
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
  } else {
    el.textContent = '';
    el.classList.remove('active', 'inactive');
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  }
}

async function copiarPrompt() {
  const text = els.prompt?.value?.trim() || '';
  if (!text) {
    setStatus('Nada para copiar. Digite seu prompt.', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Conteúdo copiado (Markdown).', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Não foi possível copiar. Verifique permissões.', 'error');
  }
}

function baixarPrompt() {
  const text = els.prompt?.value?.trim() || '';
  if (!text) {
    setStatus('Nada para baixar. Digite seu prompt.', 'warn');
    return;
  }
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replaceAll(':', '-');
  a.href = url;
  a.download = `prompt_${ts}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus('Arquivo .md gerado para download.', 'ok');
}

function extractPrompt(payload) {
  if (payload == null) return '';
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const p = item.prompt ?? item.conteudo ?? item.data;
        if (typeof p === 'string') return p;
      }
    }
    return '';
  }
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    const p = payload.prompt ?? payload.conteudo ?? payload.data;
    return typeof p === 'string' ? p : '';
  }
  return '';
}

function formatAtualizadoEm(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(+d)) return '';
    return `Atualizado em ${d.toLocaleString()}`;
  } catch { return ''; }
}

async function carregarPrompt() {
  const fluxo = els.inputFluxo?.value?.trim() || '';
  const agente = els.inputAgente?.value?.trim() || '';
  const versao = Number(els.inputVersao?.value || '1') || 1;

  if (!agente) {
    setStatus('Informe o agente.', 'warn');
    els.inputAgente?.focus();
    return;
  }

  setStatus('Carregando prompt…');
  try {
    const res = await fetch(ENDPOINT_PROMPT_CARREGAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fluxo, agente, versao }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const prompt = extractPrompt(data);
    if (els.prompt) els.prompt.value = String(prompt || '');
    updateLineCount();
    try {
      const ativoFlag = (typeof data?.prompt_ativo === 'boolean') ? data.prompt_ativo : (typeof data?.ativo === 'boolean' ? data.ativo : undefined);
      if (typeof ativoFlag === 'boolean') {
        if (els.chkAtivo) els.chkAtivo.checked = !!ativoFlag;
        updateAtivoIndicator(!!ativoFlag);
      } else {
        updateAtivoIndicator(undefined);
      }
    } catch {}
    try {
      const ts = data?.atualizado_em ?? data?.atualizadoEm;
      if (els.promptAtualizadoEm) els.promptAtualizadoEm.textContent = formatAtualizadoEm(ts);
    } catch {}
    setStatus('Prompt carregado.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao carregar prompt.', 'error');
  }
}

async function salvarPrompt() {
  const fluxo = els.inputFluxo?.value?.trim() || '';
  const agente = els.inputAgente?.value?.trim() || '';
  const conteudo = els.prompt?.value?.trim() || '';
  const ativo = !!els.chkAtivo?.checked;
  const versao = Number(els.inputVersao?.value || '1') || 1;
  if (!agente) {
    setStatus('Informe o agente para salvar.', 'warn');
    els.inputAgente?.focus();
    return;
  }
  if (!conteudo) {
    setStatus('Nada para salvar. Digite seu prompt.', 'warn');
    return;
  }
  setStatus('Salvando prompt…');
  try {
    const body = { fluxo, agente, versao, conteudo, ativo, operacao: 'salvar' };
    const res = await fetch(ENDPOINT_PROMPT_SALVAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      await fetch(`${API_BASE_URL}/promtp-salvar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {}
    setStatus('Prompt salvo.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao salvar prompt.', 'error');
  }
}

async function salvarComoNovo() {
  const fluxo = els.inputFluxo?.value?.trim() || '';
  const agenteAtual = els.inputAgente?.value?.trim() || '';
  const versaoAtual = Number(els.inputVersao?.value || '1') || 1;
  const conteudo = els.prompt?.value?.trim() || '';
  const ativo = !!els.chkAtivo?.checked;
  if (!conteudo) { setStatus('Nada para salvar.', 'warn'); return; }
  const novoAgente = window.prompt('Salvar como novo - nome do agente:', agenteAtual || '');
  if (novoAgente == null || !novoAgente.trim()) { return; }
  const novoVersaoStr = window.prompt('Salvar como novo - versão:', String(versaoAtual + 1));
  const novoVersao = Number(novoVersaoStr || versaoAtual + 1) || (versaoAtual + 1);
  setStatus('Salvando como novo…');
  try {
    const body = { fluxo, agente: novoAgente.trim(), versao: novoVersao, conteudo, ativo };
    const res = await fetch(ENDPOINT_PROMPT_SALVAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (els.inputAgente) els.inputAgente.value = body.agente;
    if (els.inputVersao) els.inputVersao.value = String(body.versao);
    setStatus('Novo prompt salvo.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao salvar como novo.', 'error');
  }
}

function buildAgentName(base, versao) {
  const slug = String(base || '')
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  const v = Number(versao || 1) || 1;
  return `${slug}_v${v}`;
}

async function criarAgente(payload) {
  setStatus('Criando agente…');
  try {
    const form = new URLSearchParams();
    Object.entries(payload || {}).forEach(([k, v]) => form.append(k, String(v ?? '')));
    const res = await fetch(ENDPOINT_CRIAR_AGENTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let data;
    try { data = await res.json(); } catch { try { const t = await res.text(); data = t ? { data: t } : {}; } catch { data = {}; } }
    setStatus('Agente criado com sucesso.', 'ok');
    return data;
  } catch (e) {
    console.error(e);
    setStatus('Erro ao criar agente.', 'error');
  }
}

function renderAgenteResultados(list) {
  if (!els.agenteResultados) return;
  els.agenteResultados.innerHTML = '';
  if (!Array.isArray(list) || !list.length) {
    const div = document.createElement('div');
    div.className = 'agent-empty';
    div.textContent = 'Nenhum agente encontrado';
    els.agenteResultados.appendChild(div);
    return;
  }
  list.forEach((item) => {
    const nome = item?.nome_final || item?.nome || item?.agente || '';
    const ativo = !!(item?.ativo);
    const fluxo = item?.fluxo || els.agenteFluxo?.value || '';
    const versao = Number(item?.versao || 1) || 1;
    const el = document.createElement('div');
    el.className = 'agent-item';
    el.tabIndex = 0;
    el.dataset.nome = nome;
    el.dataset.fluxo = fluxo;
    el.dataset.versao = String(versao);
    el.innerHTML = `<strong>${nome}</strong>
      <span class="agent-badge ${ativo ? 'active' : 'inactive'}">${ativo ? 'Ativo' : 'Inativo'}</span>
      <div class="agent-meta" style="margin-top:6px; font-size:12px; color: var(--muted);">fluxo: ${fluxo || '-'} • versão: v${versao}</div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn btn-outline btn-sm" data-action="select">Selecionar</button>
        <button class="btn btn-outline btn-sm" data-action="toggle">${ativo ? 'Desativar' : 'Ativar'}</button>
      </div>`;
    el.addEventListener('click', async (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      if (action === 'select') {
        try {
          if (els.inputAgente) els.inputAgente.value = nome || '';
          if (els.inputFluxo) els.inputFluxo.value = fluxo || '';
          if (els.inputVersao) els.inputVersao.value = String(versao || 1);
          if (els.chkAtivo) els.chkAtivo.checked = !!ativo;
          updateAtivoIndicator(!!ativo);
          await carregarPrompt();
          openModal(els.modalAgente, false);
          setStatus('Prompt carregado do agente selecionado.', 'ok');
        } catch (e) {
          console.error(e);
          setStatus('Erro ao carregar agente selecionado.', 'error');
        }
      } else if (action === 'toggle') {
        try {
          const newAtivo = !ativo;
          const body = { fluxo, agente: nome, versao, ativo: newAtivo };
          const resp = await fetch(ENDPOINT_PROMPT_ATIVAR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          setStatus(newAtivo ? 'Agente ativado.' : 'Agente desativado.', 'ok');
          const badge = el.querySelector('.agent-badge');
          if (badge) {
            badge.textContent = newAtivo ? 'Ativo' : 'Inativo';
            badge.classList.toggle('active', newAtivo);
            badge.classList.toggle('inactive', !newAtivo);
          }
          if (target) target.textContent = newAtivo ? 'Desativar' : 'Ativar';
          if (els.inputAgente?.value === nome && (els.inputFluxo?.value || '') === (fluxo || '')) {
            if (els.chkAtivo) els.chkAtivo.checked = newAtivo;
            updateAtivoIndicator(newAtivo);
          }
        } catch (e) {
          console.error(e);
          setStatus('Erro ao alterar status.', 'error');
        }
      }
    });
    els.agenteResultados.appendChild(el);
  });
}

async function buscarAgentes() {
  const fluxo = els.agenteFluxo?.value?.trim() || '';
  const base = els.agenteBase?.value?.trim() || '';
  const ativo_only = !!els.agenteAtivoOnly?.checked;
  setStatus('Buscando agentes…');
  try {
    const body = { fluxo, base, ativo_only };
    const res = await fetch(ENDPOINT_AGENTES_CARREGAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let data; try { data = await res.json(); } catch { data = []; }
    const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    renderAgenteResultados(items);
    setStatus('Busca concluída.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao buscar agentes.', 'error');
  }
}

// Eventos: copiar/baixar
els.btnCopiar?.addEventListener('click', copiarPrompt);
els.btnBaixar?.addEventListener('click', baixarPrompt);
els.btnCopyCenter?.addEventListener('click', copiarPrompt);
els.btnDownloadCenter?.addEventListener('click', baixarPrompt);
// Evento: limpar memória
els.btnLimparMemoria?.addEventListener('click', limparMemoria);

// Eventos: carregar prompt simples
els.btnCarregarPrompt?.addEventListener('click', carregarPrompt);
// Permitir Enter para carregar prompt a partir dos campos principais
['inputFluxo','inputAgente','inputVersao'].forEach((id)=>{
  const el = els[id];
  el?.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Enter') {
      ev.preventDefault();
      carregarPrompt();
    }
  });
});

// Evento: salvar prompt
els.btnSalvarPrompt?.addEventListener('click', salvarPrompt);
// Evento: abrir modal salvar como novo
els.btnSalvarComoNovo?.addEventListener('click', () => {
  const agenteAtual = els.inputAgente?.value?.trim() || '';
  const versaoAtual = Number(els.inputVersao?.value || '1') || 1;
  if (els.novoAgenteNome) els.novoAgenteNome.value = agenteAtual || '';
  if (els.novoAgenteVersao) els.novoAgenteVersao.value = String(versaoAtual + 1);
  openModal(els.modalSalvarComoNovo, true);
});
// Modal salvar como novo
els.fecharModalSalvarComoNovo?.addEventListener('click', () => openModal(els.modalSalvarComoNovo, false));
els.modalSalvarComoNovo?.addEventListener('click', (e) => { if (e.target === els.modalSalvarComoNovo) openModal(els.modalSalvarComoNovo, false); });
els.btnSalvarComoNovoConfirm?.addEventListener('click', () => {
  const nome = els.novoAgenteNome?.value?.trim() || '';
  const versao = Number(els.novoAgenteVersao?.value || '1') || 1;
  if (!nome) { setStatus('Informe o nome do agente.', 'warn'); els.novoAgenteNome?.focus(); return; }
  openModal(els.modalSalvarComoNovo, false);
  salvarComoNovo2(nome, versao);
});

// Implementação do salvamento como novo com flag de operação
async function salvarComoNovo2(novoAgente, novoVersao) {
  const fluxo = els.inputFluxo?.value?.trim() || '';
  const conteudo = els.prompt?.value?.trim() || '';
  const ativo = !!els.chkAtivo?.checked;
  if (!conteudo) { setStatus('Nada para salvar.', 'warn'); return; }
  const agenteFinal = String(novoAgente || '').trim();
  const versaoFinal = Number(novoVersao || 1) || 1;
  if (!agenteFinal) { setStatus('Informe o nome do agente.', 'warn'); return; }
  setStatus('Salvando como novo…');
  try {
    const body = { fluxo, agente: agenteFinal, versao: versaoFinal, conteudo, ativo, operacao: 'salvar_como_novo' };
    const res = await fetch(ENDPOINT_PROMPT_SALVAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (els.inputAgente) els.inputAgente.value = body.agente;
    if (els.inputVersao) els.inputVersao.value = String(body.versao);
    setStatus('Novo prompt salvo.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao salvar como novo.', 'error');
  }
}

// Modal buscar agentes
els.btnBuscarPrompts?.addEventListener('click', () => openModal(els.modalAgente, true));
els.fecharModalAgente?.addEventListener('click', () => openModal(els.modalAgente, false));
els.modalAgente?.addEventListener('click', (e) => { if (e.target === els.modalAgente) openModal(els.modalAgente, false); });
els.btnBuscarAgente?.addEventListener('click', buscarAgentes);
// Permitir Enter para buscar dentro do modal de agentes
['agenteFluxo','agenteBase'].forEach((id)=>{
  const el = els[id];
  el?.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Enter') {
      ev.preventDefault();
      buscarAgentes();
    }
  });
});

// Oculta o botão Confirmar (seleção agora aplica imediatamente)
try { if (els.btnConfirmarAgente) els.btnConfirmarAgente.style.display = 'none'; } catch {}

// Contagem de linhas do prompt
els.prompt?.addEventListener('input', updateLineCount);
updateLineCount();

// Modal criar agente
els.btnAbrirCriarAgente?.addEventListener('click', () => openModal(els.modalCriarAgente, true));
els.fecharModalCriar?.addEventListener('click', () => openModal(els.modalCriarAgente, false));
els.modalCriarAgente?.addEventListener('click', (e) => { if (e.target === els.modalCriarAgente) openModal(els.modalCriarAgente, false); });

function updateNovoPreview() {
  const b = els.novoBase?.value || '';
  const v = els.novoVersao?.value || '1';
  if (els.novoPreview) els.novoPreview.textContent = buildAgentName(b, v);
}
['input', 'change', 'keyup'].forEach((ev) => {
  els.novoBase?.addEventListener(ev, updateNovoPreview);
  els.novoVersao?.addEventListener(ev, updateNovoPreview);
});

els.btnCriarAgenteConfirm?.addEventListener('click', async () => {
  const base = els.novoBase?.value?.trim() || '';
  const versao = els.novoVersao?.value?.trim() || '1';
  const nome_final = buildAgentName(base, versao);
  const descricao = els.novoDescricao?.value || '';
  const prompt_inicial = els.novoPrompt?.value || '';
  const ativo = !!els.novoAtivo?.checked;
  if (!base) { setStatus('Informe o nome base.', 'warn'); els.novoBase?.focus(); return; }
  const payload = { nome_base: base, versao: Number(versao), nome_final, descricao, prompt_inicial, ativo };
  const resp = await criarAgente(payload);
  if (resp) {
    if (els.inputAgente) els.inputAgente.value = nome_final;
    localStorage.setItem('cacto:agente', nome_final);
    openModal(els.modalCriarAgente, false);
  }
});

// Persistência simples em localStorage
function loadPrefs() {
  const fluxo = localStorage.getItem('cacto:fluxo') || '';
  const agente = localStorage.getItem('cacto:agente') || '';
  const versao = localStorage.getItem('cacto:versao') || '1';
  if (els.inputFluxo) els.inputFluxo.value = fluxo;
  if (els.inputAgente) els.inputAgente.value = agente;
  if (els.inputVersao) els.inputVersao.value = versao;
}

function wirePrefs() {
  els.inputFluxo?.addEventListener('input', () => {
    localStorage.setItem('cacto:fluxo', els.inputFluxo.value || '');
  });
  els.inputAgente?.addEventListener('input', () => {
    localStorage.setItem('cacto:agente', els.inputAgente.value || '');
  });
  els.inputVersao?.addEventListener('input', () => {
    localStorage.setItem('cacto:versao', els.inputVersao.value || '1');
  });
}

loadPrefs();
wirePrefs();

// Opcional: se quiser auto-carregar quando já houver agente salvo, descomente:
// if ((els.inputAgente?.value || '').trim()) carregarPrompt();
