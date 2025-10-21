// Cacto Test Lab - Painel de Aprovação de Mensagens
// Visual herdado do Chat Monitor; este arquivo só adiciona comportamento.

import { ENDPOINT_CENARIOS, ENDPOINT_TESTE_INICIAR, ENDPOINT_TESTE_ENCERRAR, ENDPOINT_CRIAR_CENARIO, ENDPOINT_ACAO_TESTE } from '../../config.js';

(function () {
  // Estado atual
  let selectedScenario = '';
  let selectedFlow = '';

  const els = {
    fluxoInput: document.getElementById('fluxoInput'),
    cenarioSelecionado: document.getElementById('cenarioSelecionado'),
    btnIniciarTeste: document.getElementById('btnIniciarTeste'),
    btnEncerrarTeste: document.getElementById('btnEncerrarTeste'),
    messages: document.getElementById('messages'),
    status: document.getElementById('status'),
  };

  function setStatus(text, type = 'info') {
    if (!els.status) return;
    els.status.textContent = text || '';
    els.status.dataset.type = type;
  }

  function clearMessages() {
    if (els.messages) els.messages.innerHTML = '';
  }

  function wrapperWithAlignment(role) {
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-wrapper';
    wrapper.classList.add(role === 'user' ? 'align-right' : 'align-left');
    return wrapper;
  }

  // Bolha de mensagem (aprovacao/edicao/encerrar)
  function createBubble({ autor, mensagem, status = 'pendente', testeId, resumeUrl }) {
    const isCliente = String(autor || '').toLowerCase().includes('cliente');
    const role = isCliente ? 'user' : 'agent';

    const wrapper = wrapperWithAlignment(role);
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.dataset.status = status;

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = mensagem || '';
    bubble.appendChild(content);

    const statusTag = document.createElement('div');
    statusTag.className = 'status-tag';
    updateStatusTag(statusTag, status);
    bubble.appendChild(statusTag);

    if (status === 'pendente' && testeId) {
      const actions = document.createElement('div');
      actions.className = 'actions';

      const btnApprove = document.createElement('button');
      btnApprove.className = 'btn primary';
      btnApprove.textContent = 'Aprovar';
      btnApprove.addEventListener('click', async () => {
        await handleAction('approve', { testeId, bubble, statusTag, actions, content });
      });

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn secondary';
      btnEdit.textContent = 'Editar';
      btnEdit.addEventListener('click', async () => {
        await handleAction('edit', { testeId, bubble, statusTag, actions, content });
      });

      const btnEnd = document.createElement('button');
      btnEnd.className = 'btn danger';
      btnEnd.textContent = 'Encerrar';
      btnEnd.addEventListener('click', async () => {
        await handleAction('end', { testeId, bubble, statusTag, actions, content });
      });

      actions.appendChild(btnApprove);
      actions.appendChild(btnEdit);
      actions.appendChild(btnEnd);
      bubble.appendChild(actions);
    }

    wrapper.appendChild(bubble);
    return wrapper;
  }

  function updateStatusTag(el, status) {
    const map = {
      pendente: 'Aguardando aprovacao',
      aprovada: '✅ Aprovada',
      editada: '✏️ Editada',
      encerrada: '🚫 Encerrada',
    };
    el.textContent = map[status] || '';
  }

  async function handleAction(type, ctx) {
    const { testeId, bubble, statusTag, actions, content } = ctx || {};
    if (!testeId) return;

    try {
      if (type === 'approve') {
        const mensagemAtual = content?.textContent ?? '';
        await fetch(ENDPOINT_ACAO_TESTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve', teste_id: testeId, mensagem: mensagemAtual, fluxo: (selectedFlow || '').trim() })
        });
        bubble.dataset.status = 'aprovada';
        bubble.classList.add('status-aprovada');
        updateStatusTag(statusTag, 'aprovada');
      } else if (type === 'edit') {
        const novoTexto = window.prompt('Edite a mensagem:', content?.textContent ?? '') || '';
        if (!novoTexto) return;
        await fetch(ENDPOINT_ACAO_TESTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', teste_id: testeId, mensagem: novoTexto, fluxo: (selectedFlow || '').trim() })
        });
        if (content) content.textContent = novoTexto;
        bubble.dataset.status = 'editada';
        bubble.classList.add('status-editada');
        updateStatusTag(statusTag, 'editada');
      } else if (type === 'end') {
        const mensagemAtual = content?.textContent ?? '';
        await fetch(ENDPOINT_ACAO_TESTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end', teste_id: testeId, mensagem: mensagemAtual, fluxo: (selectedFlow || '').trim() })
        });
        bubble.dataset.status = 'encerrada';
        bubble.classList.add('status-encerrada');
        updateStatusTag(statusTag, 'encerrada');
      }
    } catch (e) {
      console.error(e);
    } finally {
      actions?.remove();
    }
  }

  function append(wrapper) {
    els.messages.appendChild(wrapper);
    els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: 'smooth' });
  }

  function normalizePendentes(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((m) => ({
      id: m.id,
      autor: m.autor || m.quem || m.role || 'agente',
      mensagem: m.mensagem || m.message || m.texto || m.text || '',
      resumeUrl: m.resumeUrl || m.resume_url || m.url || '',
      testeId: m.teste_id || m.testeId || m.session_id || m.sessionId,
    }));
  }

  function renderMensagens(data) {
    clearMessages();
    const items = normalizePendentes(data);
    if (!items.length) { setStatus('Nenhuma mensagem pendente encontrada.', 'info'); return; }
    items.forEach((it) => {
      const wrap = createBubble({ autor: it.autor, mensagem: it.mensagem, testeId: it.testeId, status: 'pendente' });
      append(wrap);
    });
    setStatus(`Carregadas: ${items.length} mensagens pendentes.`, 'ok');
  }

  // Iniciar/Encerrar teste
  async function iniciarTeste() {
    const fluxo = (selectedFlow || '').trim();
    if (!fluxo) { setStatus('Selecione um fluxo no modal de cenarios.', 'warn'); return; }
    if (!selectedScenario) { setStatus('Selecione um cenario para iniciar.', 'warn'); return; }
    els.btnIniciarTeste.disabled = true;
    try {
      setStatus('Iniciando teste e aguardando resposta do backend...', 'info');
      const res = await fetch(ENDPOINT_TESTE_INICIAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'iniciar', cenario: selectedScenario, fluxo })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Lê resposta com a primeira mensagem + resume_url
      let maybe = null;
      try { maybe = await res.json(); } catch (_) { maybe = null; }

      let payload = [];
      if (Array.isArray(maybe)) payload = maybe;
      else if (maybe && typeof maybe === 'object') payload = [maybe];

      // Renderiza na UI e expõe a resposta
      if (Array.isArray(payload) && payload.length) {
        const itens = payload.map(x => ({
          autor: 'agente',
          mensagem: x.mensagem || x.message || x.texto || x.text || '',
          testeId: x.teste_id || x.testeId || x.session_id || x.sessionId || '',
          status: 'pendente'
        }));
        clearMessages();
        itens.forEach(it => append(createBubble(it)));
        // Normaliza e expõe no formato especificado
        window.cactoLastStartResponse = payload.map(x => ({
          resume_url: x.resume_url || x.resumeUrl,
          mensagem: x.mensagem || x.message || x.texto || x.text || '',
          teste_id: x.teste_id || x.testeId || x.session_id || x.sessionId || ''
        }));
        setStatus('Pronto: mensagem e webhook recebidos.', 'ok');
      } else {
        setStatus('Resposta do backend vazia ao iniciar teste.', 'warn');
      }
    } catch (e) {
      console.error(e);
      setStatus('Falha ao iniciar teste: ' + e.message, 'error');
    } finally {
      els.btnIniciarTeste.disabled = false;
    }
  }

  async function encerrarTeste() {
    const fluxo = (selectedFlow || '').trim();
    try {
      const res = await fetch(ENDPOINT_TESTE_ENCERRAR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'encerrar', cenario: selectedScenario || undefined, fluxo: fluxo || undefined }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus('Teste encerrado.', 'ok');
      selectedScenario = '';
      if (els.cenarioSelecionado) els.cenarioSelecionado.textContent = 'Nenhum cenario';
      selectedFlow = '';
      const flowEl = document.getElementById('fluxoSelecionado');
      if (flowEl) flowEl.textContent = 'Nenhum fluxo';
    } catch (e) {
      console.error(e);
      setStatus('Falha ao encerrar teste: ' + e.message, 'error');
    }
  }

  els.btnIniciarTeste?.addEventListener('click', iniciarTeste);
  els.btnEncerrarTeste?.addEventListener('click', encerrarTeste);

  // --- Modais (buscar/selecionar e criar cenario) ---
  const modal = {
    buscarBtn: document.getElementById('btnBuscarCenarios'),
    criarBtn: document.getElementById('btnAbrirCriarCenario'),
    modalCenario: document.getElementById('modalCenario'),
    fecharModalCenario: document.getElementById('fecharModalCenario'),
    cenarioFluxo: document.getElementById('cenarioFluxo'),
    btnBuscarCenario: document.getElementById('btnBuscarCenario'),
    cenarioResultados: document.getElementById('cenarioResultados'),
    btnConfirmarCenario: document.getElementById('btnConfirmarCenario'),
    modalCriar: document.getElementById('modalCriarCenario'),
    fecharModalCriar: document.getElementById('fecharModalCriarCenario'),
    novoFluxo: document.getElementById('novoCenarioFluxo'),
    novoNome: document.getElementById('novoCenarioNome'),
    novoDescricao: document.getElementById('novoCenarioDescricao'),
    btnCriarConfirm: document.getElementById('btnCriarCenarioConfirm'),
  };

  function openModal(el, open = true) {
    if (!el) return;
    if (open) { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); try { el.style.display = 'grid'; } catch {} }
    else { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); try { el.style.display = 'none'; } catch {} }
  }

  modal.buscarBtn?.addEventListener('click', () => openModal(modal.modalCenario, true));
  modal.criarBtn?.addEventListener('click', () => openModal(modal.modalCriar, true));
  modal.fecharModalCenario?.addEventListener('click', () => openModal(modal.modalCenario, false));
  modal.fecharModalCriar?.addEventListener('click', () => openModal(modal.modalCriar, false));

  modal.btnBuscarCenario?.addEventListener('click', async () => {
    const fluxo = modal.cenarioFluxo?.value?.trim() || els.fluxoInput?.value?.trim() || '';
    if (!fluxo) { setStatus('Informe o fluxo para buscar cenarios.', 'warn'); return; }
    setStatus('Buscando cenarios...');
    try {
      const url = new URL(ENDPOINT_CENARIOS);
      url.searchParams.set('fluxo', fluxo);
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      // Normaliza: [{ cenarios: [...] }] ou ["a","b"]
      let list = [];
      if (Array.isArray(data)) {
        if (Array.isArray(data[0]?.cenarios)) list = data[0].cenarios;
        else list = data;
      }
      modal.cenarioResultados.innerHTML = '';
      if (!list.length) {
        modal.cenarioResultados.innerHTML = '<div class="agent-empty">Nenhum cenario encontrado.</div>';
        setStatus('Nenhum cenario encontrado.', 'info');
        return;
      }
      list.forEach((name) => {
        const item = document.createElement('div');
        item.className = 'agent-item';
        item.textContent = String(name);
        item.addEventListener('click', () => {
          selectedScenario = String(name);
          [...modal.cenarioResultados.children].forEach(ch => ch.classList.remove('selected'));
          item.classList.add('selected');
        });
        modal.cenarioResultados.appendChild(item);
      });
      setStatus(`Cenarios carregados: ${list.length}`, 'ok');
    } catch (e) {
      console.error(e);
      setStatus('Falha ao buscar cenarios: ' + e.message, 'error');
    }
  });

  modal.btnConfirmarCenario?.addEventListener('click', () => {
    if (!selectedScenario) { setStatus('Selecione um cenario.', 'warn'); return; }
    const fluxo = modal.cenarioFluxo?.value?.trim() || '';
    if (!fluxo) { setStatus('Informe o fluxo no modal para confirmar.', 'warn'); return; }
    selectedFlow = fluxo;
    if (els.cenarioSelecionado) els.cenarioSelecionado.textContent = selectedScenario;
    const flowEl = document.getElementById('fluxoSelecionado');
    if (flowEl) flowEl.textContent = selectedFlow;
    openModal(modal.modalCenario, false);
  });

  modal.btnCriarConfirm?.addEventListener('click', async () => {
    const fluxo = modal.novoFluxo?.value?.trim() || '';
    const nome = modal.novoNome?.value?.trim() || '';
    const descricao = modal.novoDescricao?.value?.trim() || '';
    if (!fluxo || !nome) { setStatus('Informe fluxo e nome do cenario.', 'warn'); return; }
    try {
      const res = await fetch(ENDPOINT_CRIAR_CENARIO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fluxo, nome, descricao }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus('Cenario criado com sucesso.', 'ok');
      openModal(modal.modalCriar, false);
    } catch (e) {
      console.error(e);
      setStatus('Falha ao criar cenario: ' + e.message, 'error');
    }
  });

  // Expor utilitários (opcional)
  window.handleAction = handleAction;
  window.renderMensagens = renderMensagens;
})();
