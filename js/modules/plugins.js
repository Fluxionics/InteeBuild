'use strict';

(() => {
  $$('.plugin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.plugin-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.ptab;
      $$('.plugin-cat').forEach((c) => {
        c.classList.toggle('active', c.dataset.pcat === cat);
      });
    });
  });

  $$('.plugin-card').forEach((card) => {
    const chk = card.querySelector('input[type="checkbox"]');
    const rad = card.querySelector('input[type="radio"]');
    if (chk) {
      card.classList.toggle('checked', chk.checked);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        chk.checked = !chk.checked;
        card.classList.toggle('checked', chk.checked);
        if (chk.name === 'plugin_inteebridge') {
          setVisible($('#integridgeInfo'), chk.checked);
        }
      });
    } else if (rad) {
      card.classList.toggle('checked', rad.checked);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        $$('input[name="provider"]').forEach((r) => { r.checked = false; });
        $$('.plugin-card input[name="provider"]').forEach((r) => r.closest('.plugin-card').classList.remove('checked'));
        rad.checked = true;
        card.classList.add('checked');
      });
    }
  });
})();
