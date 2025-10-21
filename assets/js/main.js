// Cacto AI Suite — script principal
// Mantido propositalmente minimalista. Expanda conforme necessidade.

(function () {
  'use strict';

  // Impede interação dos botões "Em breve" e fornece feedback mínimo.
  document.querySelectorAll('.btn-soon').forEach(function (btn) {
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      // Sinalização leve de estado (sem popups intrusivos)
      btn.style.filter = 'brightness(1.1)';
      setTimeout(function () { btn.style.filter = ''; }, 120);
    });
  });

  // Log discreto de inicialização (útil em desenvolvimento)
  if (typeof window !== 'undefined') {
    console.debug('[Cacto AI Suite] Portal iniciado.');
  }
})();

