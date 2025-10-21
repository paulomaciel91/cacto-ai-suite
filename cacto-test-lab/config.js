// ==============================
// Configurações — Cacto Test Lab
// ==============================

// Endpoints (n8n)
export const API_BASE_URL = "https://flow.cactoai.com/webhook";
// Lista mensagens pendentes de aprovação (GET)
export const ENDPOINT_PENDENTES = `${API_BASE_URL}/pendentes`;
// Opcional: registrar ações em banco (POST)
export const ENDPOINT_APROVACAO = `${API_BASE_URL}/aprovacao`;
// Cenários (GET com ?fluxo=)
export const ENDPOINT_CENARIOS = `${API_BASE_URL}/cenarios`;

// Outros endpoints existentes no projeto (não usados diretamente aqui)
export const ENDPOINT_TEST_LAB = `${API_BASE_URL}/test-lab/start`;
export const ENDPOINT_LIMPAR = `${API_BASE_URL}/memoria-limpar`;

// Endpoints fixos para iniciar/encerrar testes
export const ENDPOINT_TESTE_INICIAR = `${API_BASE_URL}/test-lab/start`;
export const ENDPOINT_TESTE_ENCERRAR = `${API_BASE_URL}/test-lab/end`;

// Criar cenário (segue padrão do Prompt Studio de criação)
export const ENDPOINT_CRIAR_CENARIO = `${API_BASE_URL}/criar-cenario`;
export const ENDPOINT_ACAO_TESTE = `${API_BASE_URL}/acao-teste`;
