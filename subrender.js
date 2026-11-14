/* Yomi Frost Web - 字幕レンダラー(アプリ内プレビュー / 小窓 / 将来のOBS・補助exeで共通利用) */
(function (root) {
  'use strict';

  const BOX_IDS = ['stt', 'tr', 'cmt', 'raid'];
  const BOX_LABEL = { stt: '聞き取り字幕', tr: '翻訳字幕', cmt: 'コメント翻訳字幕', raid: 'レイド紹介字幕' };
  const SAMPLE = {
    stt: [{ text: 'こんにちは!今日もゆるっと配信していきます' }],
    tr: [{ text: "Hello! I'll be streaming casually today too." }],
    cmt: [{ name: 'alice', text: 'Hi! Nice to meet you', orig: 'こんにちは!はじめまして' }, { name: 'bob', text: 'First time here', orig: '初見です' }],
    raid: [{ title: 'compactさんのＡＩ紹介', text: 'ゲームも雑談も全力で楽しむ、明るさが魅力の配信者さん!視聴者さんとの距離の近さと、丁寧なリアクションが人気の理由です。' }],
  };

  const CSS = `
.yf-stage{position:relative;width:100%;height:100%;overflow:hidden}
.yf-box{position:absolute;display:flex;flex-direction:column;box-sizing:border-box;padding:6px 10px;overflow:hidden;border-radius:12px}
.yf-box.vb{justify-content:flex-end}.yf-box.vt{justify-content:flex-start}
.yf-line{display:block;line-height:1.15;margin:.06em 0;word-break:break-word;animation:yfIn .25s ease-out}
.yf-line>span{-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:.04em .35em;border-radius:.3em}
.yf-line.bub{margin:.3em 0 .45em .7em}
.yf-line.bub>span.yf-bubble{display:inline-block;position:relative;padding:.3em .7em;border-radius:.9em;max-width:calc(100% - 1em);box-sizing:border-box;text-align:left}
.yf-line.bub>span.yf-bubble::before{content:"";position:absolute;left:-.55em;bottom:.25em;border-style:solid;border-width:.35em .65em .35em 0;border-color:transparent var(--bub) transparent transparent}
.yf-box.ar .yf-line.bub{margin:.3em .7em .45em 0}
.yf-box.ar .yf-line.bub>span.yf-bubble::before{left:auto;right:-.55em;border-width:.35em 0 .35em .65em;border-color:transparent transparent transparent var(--bub)}
.yf-line.interim{opacity:.6}
.yf-line.old{animation:none}
.yf-name{font-size:.7em;opacity:.85;margin-right:.4em}
.yf-emote{height:1.25em;width:auto;vertical-align:-0.28em;margin:0 .06em}
.yf-tr2{display:inline-block;font-size:.78em;opacity:.95;margin-top:.1em}
.yf-arrow{opacity:.75;margin:0 .35em}
.yf-box[data-id=raid]{z-index:5}
.yf-title{display:block;font-weight:800;font-size:.8em;opacity:.9;margin-bottom:.15em}
.yf-line.live>span::after{content:"▍";opacity:.6;animation:yfBlink .8s steps(2) infinite}
@keyframes yfBlink{50%{opacity:0}}
@keyframes yfIn{from{opacity:0;transform:translateY(6px)}}
.yf-edit .yf-box{--bx:#ffd23f;outline:3px dashed var(--bx);box-shadow:0 0 0 2px var(--halo,rgba(0,0,0,.5)),inset 0 0 0 2px var(--halo,rgba(0,0,0,.5));cursor:move}
.yf-edit .yf-box[data-id=stt]{--bx:var(--bc-stt,#ffb020)} .yf-edit .yf-box[data-id=tr]{--bx:var(--bc-tr,#ff6b6b)} .yf-edit .yf-box[data-id=cmt]{--bx:var(--bc-cmt,#5bc0ff)}
.yf-edit .yf-box.sel{outline:4px solid var(--bx)}
.yf-edit .yf-box .yf-tag{text-shadow:none;z-index:2;position:absolute;left:4px;top:2px;font:800 11px sans-serif;background:var(--bx);color:#2b1d4a;padding:1px 6px;border-radius:6px;pointer-events:none;box-shadow:0 0 0 2px var(--halo,rgba(0,0,0,.5))}
.yf-edit .yf-box .yf-rs{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;
  background:linear-gradient(135deg,transparent 50%,var(--bx) 50%);border-bottom-right-radius:10px}
.yf-edit .yf-box.off{opacity:.25}
`;

  /** 文字+スタンプ画像 */
  function addParts(doc, parent, parts, text) {
    if (!parts || !parts.length) { parent.appendChild(doc.createTextNode(text || '')); return; }
    for (const p of parts) {
      if (p.t === 'emote' && p.url) {
        const im = doc.createElement('img'); im.className = 'yf-emote'; im.src = p.url; im.alt = p.code; im.referrerPolicy = 'no-referrer';
        parent.appendChild(im);
      } else parent.appendChild(doc.createTextNode(p.t === 'emote' ? p.code : p.text));
    }
  }
  function hexA(hex, a) {
    const h = String(hex || '#000000').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function outline(color, w) {
    w = Number(w) || 0;
    if (w <= 0) return 'none';
    const s = [];
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      s.push(`${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${color}`);
    }
    return s.join(',');
  }

  /**
   * stage: 描画先の要素 / boxes: {id:{cfg, lines}} / opts: {edit, sel, onlyOutput:'pip'}
   */
  function render(stage, boxes, opts) {
    opts = opts || {};
    const doc = stage.ownerDocument;
    stage.classList.add('yf-stage');
    stage.classList.toggle('yf-edit', !!opts.edit);
    for (const id of BOX_IDS) {
      const b = boxes[id];
      let el = stage.querySelector(`.yf-box[data-id="${id}"]`);
      const visible = b && b.cfg.on && (!opts.onlyOutput || (b.cfg.out && b.cfg.out[opts.onlyOutput]));
      if (!visible && !opts.edit) { if (el) el.remove(); continue; }
      if (!el) {
        el = doc.createElement('div');
        el.className = 'yf-box';
        el.dataset.id = id;
        stage.appendChild(el);
      }
      const c = b.cfg;
      el.classList.toggle('off', !visible);
      el.classList.toggle('sel', opts.sel === id);
      el.classList.toggle('vb', c.valign !== 'top');
      el.classList.toggle('vt', c.valign === 'top');
      el.classList.toggle('ar', c.align === 'right');
      Object.assign(el.style, {
        left: c.x + '%', top: c.y + '%', width: c.w + '%', height: c.h + '%',
        textAlign: c.align || 'center',
        fontFamily: `"${c.font}", "M PLUS Rounded 1c", sans-serif`,
        fontSize: c.size + 'px', fontWeight: c.bold ? '800' : '500',
        color: c.color,
        textShadow: outline(c.stroke, c.strokeW),
        background: c.frame ? hexA(c.frameBg, c.frameBgA) : 'transparent',
        border: c.frame ? `3px solid ${c.frameColor}` : '3px solid transparent',
      });
      let lines = (b.lines || []).slice(-Math.max(1, c.maxLines || 2));
      if (opts.edit && !lines.length) lines = SAMPLE[id];
      const seen = new Set((el.dataset.keys || '').split('|'));
      el.innerHTML = '';
      const keys = [];
      if (opts.edit) {
        const tag = doc.createElement('div'); tag.className = 'yf-tag'; tag.textContent = BOX_LABEL[id];
        const rs = doc.createElement('div'); rs.className = 'yf-rs';
        el.append(tag, rs);
      }
      for (const ln of lines) {
        const row = doc.createElement('div');
        const k = String(ln.id != null ? ln.id : ln.text);
        keys.push(k);
        const bub = (id === 'cmt' || id === 'raid') && c.band && c.bandShape === 'bubble';   // コメントごとのセリフ枠
        row.className = 'yf-line' + (ln.interim ? ' interim' : '') + (seen.has(k) ? ' old' : '') + (bub ? ' bub' : '') + (ln.live ? ' live' : '');
        const span = doc.createElement('span');
        if (c.band) span.style.background = hexA(c.bandColor, c.bandA);
        if (bub) { span.className = 'yf-bubble'; span.style.setProperty('--bub', hexA(c.bandColor, c.bandA)); }
        if (ln.title) { const tt = doc.createElement('span'); tt.className = 'yf-title'; tt.textContent = ln.title; span.appendChild(tt); }
        if (ln.name && c.showName) {
          const n = doc.createElement('span'); n.className = 'yf-name'; n.textContent = ln.name;
          span.appendChild(n);
        }
        const mode = id === 'cmt' ? (c.cmtShow || 'trans') : 'trans';
        if (mode === 'both' && (ln.orig || ln.origParts)) {
          addParts(doc, span, ln.origParts, ln.orig);
          if (c.cmtBoth === 'arrow') {
            const ar = doc.createElement('span'); ar.className = 'yf-arrow'; ar.textContent = '→'; span.appendChild(ar);
            addParts(doc, span, ln.parts, ln.text);
          } else {
            span.appendChild(doc.createElement('br'));
            const t2 = doc.createElement('span'); t2.className = 'yf-tr2'; addParts(doc, t2, ln.parts, ln.text); span.appendChild(t2);
          }
        } else if (mode === 'orig' && opts.edit && ln.orig && !ln.parts) {
          span.appendChild(doc.createTextNode(ln.orig));     // 見本は原文で表示
        } else addParts(doc, span, ln.parts, ln.text);
        row.appendChild(span);
        el.appendChild(row);
      }
      el.dataset.keys = keys.join('|');
    }
  }

  root.YFSub = { BOX_IDS, BOX_LABEL, CSS, render, hexA };
})(typeof window !== 'undefined' ? window : globalThis);
