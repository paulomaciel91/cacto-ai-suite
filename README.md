# Cacto AI Suite

Portal web da suite de agentes inteligentes Cacto AI.

## Estrutura

```
cacto-ai-suite/
├── index.html
├── prompt-studio/
├── chat-monitor/
├── assets/
│   ├── css/style.css
│   └── js/main.js
└── README.md
```

As pastas `prompt-studio/` e `chat-monitor/` devem conter seus respectivos projetos HTML (adicionados separadamente).

## Uso

- Abra `index.html` diretamente no navegador ou sirva com um servidor HTTP simples.
- Links dos módulos existentes:
  - `/prompt-studio/index.html`
  - `/chat-monitor/index.html`

## Visual

- Tema escuro com fundo `#0C0F1A`.
- Cards com fundo `#121826`, cantos arredondados e sombra suave.
- Tipografia: Inter (fallbacks do sistema).
- Botões:
  - "Abrir": verde `#00B37E` (hover `#00E09D`).
  - "Em breve": marrom escuro `#5C3A00` (texto branco).

## Acessibilidade & Responsividade

- Grid responsivo: 3 colunas (desktop), 2 (tablet), 1 (mobile).
- Estados de foco visíveis e animações sutis (reduzidas com `prefers-reduced-motion`).

## Licença

Todos os direitos reservados.

