(function (root) {
  'use strict';

  root.PolySlice = root.PolySlice || {};
  root.PolySlice.Debug = {
    attach(game) {
      if (new URLSearchParams(root.location.search).get('debug') !== '1') return;
      root.document.body.classList.add('debug-enabled');

      const panel = root.document.createElement('div');
      panel.setAttribute('aria-label', 'Round debugger');
      panel.style.cssText = [
        'position:fixed',
        'top:84px',
        'right:16px',
        'z-index:100',
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:10px',
        'background:#121526',
        'border:1px solid rgba(255,255,255,.2)',
        'border-radius:6px',
        'box-shadow:0 8px 24px rgba(0,0,0,.4)',
        'color:#f0f4fc',
        'font:13px sans-serif'
      ].join(';');

      const label = root.document.createElement('label');
      label.textContent = 'Debug round';

      const input = root.document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      input.value = String(game.round);
      input.setAttribute('aria-label', 'Round number');
      input.style.cssText = 'width:72px;padding:6px;border:1px solid #536078;border-radius:4px;background:#0d101d;color:#f0f4fc';

      const button = root.document.createElement('button');
      button.type = 'button';
      button.textContent = 'Go';
      button.style.cssText = 'padding:6px 10px;border:0;border-radius:4px;background:#00f0ff;color:#0a0c14;font-weight:700;cursor:pointer';

      const status = root.document.createElement('span');
      status.setAttribute('aria-live', 'polite');

      panel.append(label, input, button, status);
      root.document.body.append(panel);

      const loadSelectedRound = () => {
        const round = Number(input.value);
        if (!Number.isSafeInteger(round) || round < 1) {
          status.textContent = ' Enter a round above 0';
          return;
        }

        if (game.gameMode === 'percentChallenge' && game.round === round) {
          status.textContent = ` Round ${round} loaded`;
          return;
        }

        if (game.gameMode !== 'percentChallenge') {
          game.setGameMode('percentChallenge');
          root.document.querySelectorAll('.mode-tabs .tab-btn').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.mode === 'percentChallenge');
          });
          const customDrawBar = root.document.getElementById('custom-draw-bar');
          if (customDrawBar) customDrawBar.classList.remove('active');
        }

        game.generateRound(round);
        status.textContent = round >= 21 ? ' Slow float active' : ` Round ${round} loaded`;
      };

      input.addEventListener('change', loadSelectedRound);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadSelectedRound();
      });
      button.addEventListener('click', loadSelectedRound);
    }
  };
})(window);