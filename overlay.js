/* 字幕の描画(アプリと同じ subrender.js を使う) */
(() => {
  'use strict';
  const stage = document.getElementById('stage');
  const hint = document.getElementById('hint');
  const st = document.createElement('style'); st.textContent = YFSub.CSS; document.head.appendChild(st);
  let hideT = 0, last = null, state = {};
  function say(msg, keep) {
    hint.textContent = 'Yomi Frost 字幕: ' + msg; hint.classList.remove('hide');
    clearTimeout(hideT); if (!keep) hideT = setTimeout(() => hint.classList.add('hide'), 5000);
  }
  /** アプリの小窓の大きさで作った配置を、この窓の大きさに合わせて拡大する(縦横比を保って中央) */
  function fit(p) {
    const W = Number(p.pipW) || 800, H = Number(p.pipH) || 450;
    const k = Math.min(innerWidth / W, innerHeight / H);
    Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: ((innerWidth - W * k) / 2) + 'px', top: ((innerHeight - H * k) / 2) + 'px', transform: `scale(${k})` });
  }
  function draw(p) {
    last = p; fit(p);
    const boxes = {};
    for (const id of YFSub.BOX_IDS) {
      const b = p.boxes && p.boxes[id];
      if (b) boxes[id] = { cfg: b.cfg, lines: b.lines || [] };
    }
    YFSub.render(stage, boxes, { onlyOutput: 'exe' });
  }
  addEventListener('resize', () => { if (last) draw(last); });
  window.yfExe.onPayload(p => {
    if (!state.got) { state.got = true; say('字幕を受信中 ✨'); }
    draw(p);
  });
  window.yfExe.onState(s => {
    const was = state.clients;
    Object.assign(state, s);
    document.body.classList.toggle('editing', !!s.editing);
    if (s.editing) say(`位置とサイズの調整中(終わったら「調整おわり」か ${s.shortcut})`, true);
    else if (!s.clients) { state.got = false; if (was !== 0) say(`アプリを待っています(ポート ${s.port})。アプリの字幕タブで「補助exeに送る」をオンにしてね`); }
    else say('アプリと接続しました');
  });
  document.getElementById('done').addEventListener('click', () => window.yfExe.endEdit());
})();
