# 🧪 Cacto Test Lab

Projeto HTML/CSS/JS puro para simular cenários de teste automatizados via n8n, seguindo o padrão visual da Cacto AI Suite.

## Estrutura

```
cacto-test-lab/
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/main.js
└── README.md
```

## Como usar

1. Abra `cacto-test-lab/index.html` no navegador.
2. Informe o `fluxo` (obrigatório) para carregar os cenários.
3. Selecione um cenário.
4. Clique em "Iniciar Teste" (exige `fluxo` e `cenário`) para enviar um POST para o webhook do n8n:
   - URL: `https://api.cactoai.com/webhook/test-lab`
   - Body:
     ```json
     { "cenario": "Cliente confuso" }
     ```
4. A resposta do endpoint é exibida na área "Mensagens do Teste" como uma bolha do **Agente**.

> Observação: Em ambientes locais, a requisição pode falhar por CORS ou rede. O erro será exibido no chat e no console.

## Ações

- ✏️ Editar Mensagem: atualmente apenas registra no console.
- ✅ Aprovar e Enviar: atualmente apenas registra no console.
- ⛔ Encerrar Teste: atualmente apenas registra no console.

## Estilo

- Tema escuro: fundo `#0C0F1A`, cards `#121826`.
- Tipografia: Inter (Google Fonts).
- Botões coloridos, grandes, com animação no hover.
- Balões de mensagem em estilo chat (Cliente Simulado vs Agente).

## Integração futura

O código está comentado e com pontos de extensão marcados no `main.js` para integrar com o backend (n8n), como editar/aprovar/encerrar.
