(function(){
  const container = document.getElementById('cards');
  const empty = document.getElementById('empty');
  const MAX = 20;
  let list = [];

  function render(){
    container.innerHTML = '';
    if (!list.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'pat-card';
      const top = document.createElement('div'); top.className='pat-top';
      const name = document.createElement('div'); name.className='pat-name'; name.textContent = p.nombreCompleto || '—';
      const box = document.createElement('div'); box.className='pat-box'; box.textContent = p.boxId ? ('Box ' + p.boxId.replace(/^box/i,'')) : 'Sin box';
      top.appendChild(name); top.appendChild(box);
      const meta = document.createElement('div'); meta.className='pat-meta'; meta.textContent = (p.tipoAtencion||'') + (p.edad?(' · ' + p.edad + ' años'):'') + (p.rut?(' · ' + p.rut):'');
      card.appendChild(top); card.appendChild(meta);
      container.appendChild(card);
    });
  }

  function pushPatient(p) {
    list.unshift(p);
    if (list.length > MAX) list = list.slice(0, MAX);
    render();
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('callbox_channel');
      bc.onmessage = (ev) => {
        try {
          if (ev.data && ev.data.type === 'NEW_PATIENT') pushPatient(ev.data.data);
        } catch(e){}
      };
    } catch(e){ console.warn('BroadcastChannel not available', e); }
  }

  try {
    const ws = new WebSocket((location.protocol==='https:'?'wss:':'ws:') + '//' + location.host);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && msg.type === 'NEW_PATIENT' && msg.data) pushPatient(msg.data);
        if (msg && msg.type === 'PATIENT_CALL' && msg.data) pushPatient(msg.data.paciente || msg.data);
      } catch(e){}
    };
    ws.onopen = ()=>console.log('WS connected to server for real-time updates');
    ws.onclose = ()=>console.log('WS closed');
    ws.onerror = ()=>{/* ignore */};
  } catch(e){ /* ignore */ }

  window._callbox_receiver = { pushPatient };
})();