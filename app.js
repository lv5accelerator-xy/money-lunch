(() => {
  'use strict';

  // ---------- 存储 ----------
  const KEY = 'money-lunch:v1';
  const defaultState = () => ({ restaurants: [], transactions: [] });

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (data && Array.isArray(data.restaurants) && Array.isArray(data.transactions)) return data;
    } catch (e) { /* 忽略损坏或不可用的存储 */ }
    return defaultState();
  }

  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存储不可用时仅在内存中保留 */ }
  }

  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 金额统一用“分”（整数）保存，避免浮点误差
  const toCents = (str) => Math.round(parseFloat(str) * 100);
  const fmt = (cents) => (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ---------- 标签页 ----------
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // ---------- 转盘 ----------
  const COLORS = ['#ff8787', '#ffa94d', '#ffd43b', '#a9e34b', '#69db7c', '#38d9a9', '#3bc9db', '#4dabf7', '#748ffc', '#9775fa', '#da77f2', '#f783ac'];
  const canvas = $('wheelCanvas');
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;
  const POINTER = -Math.PI / 2; // 指针在正上方
  let rotation = 0;
  let spinning = false;

  const colorFor = (i, n) => {
    // 避免首尾两块颜色相同
    let c = COLORS[i % COLORS.length];
    if (n > 1 && i === n - 1 && i % COLORS.length === 0) c = COLORS[5];
    return c;
  };

  function drawWheel() {
    const list = state.restaurants;
    const size = canvas.width;
    const cx = size / 2, cy = size / 2, r = size / 2 - 12;
    ctx.clearRect(0, 0, size, size);

    if (list.length === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = '#ece7df'; ctx.fill();
      ctx.fillStyle = '#8a8580'; ctx.font = '28px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('先在右边添加饭店', cx, cy);
      return;
    }

    const n = list.length;
    const seg = TAU / n;
    for (let i = 0; i < n; i++) {
      const start = rotation + i * seg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + seg);
      ctx.closePath();
      ctx.fillStyle = colorFor(i, n);
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();

      // 文字
      ctx.save();
      ctx.translate(cx, cy);
      const mid = start + seg / 2;
      // 左半边的文字翻转过来，避免倒着显示
      const flip = Math.cos(mid) < 0;
      ctx.rotate(flip ? mid + Math.PI : mid);
      ctx.textAlign = flip ? 'left' : 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2b2b2b';
      const fontSize = Math.max(16, Math.min(30, 300 / n + 10));
      ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
      let name = list[i].name;
      const maxW = r - 60;
      while (ctx.measureText(name).width > maxW && name.length > 1) name = name.slice(0, -1);
      if (name !== list[i].name) name = name.slice(0, -1) + '…';
      ctx.fillText(name, flip ? -(r - 20) : r - 20, 0);
      ctx.restore();
    }

    // 中心圆
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#2b2b2b'; ctx.stroke();
  }

  function renderRestaurants() {
    const ul = $('restaurantList');
    const n = state.restaurants.length;
    ul.innerHTML = state.restaurants.map((r, i) => `
      <li>
        <span><span class="dot" style="background:${colorFor(i, n)}"></span>${escapeHtml(r.name)}</span>
        <button class="del" data-id="${r.id}" title="删除">×</button>
      </li>`).join('');
    $('restaurantOptions').innerHTML = state.restaurants.map((r) => `<option value="${escapeHtml(r.name)}">`).join('');
    $('spinBtn').disabled = n < 2 || spinning;
    $('clearRestaurants').style.display = n ? '' : 'none';
    drawWheel();
  }

  $('restaurantForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('restaurantInput');
    const names = input.value.split(/[,，、;；\n]+/).map((s) => s.trim()).filter(Boolean);
    const existing = new Set(state.restaurants.map((r) => r.name));
    for (const name of names) {
      if (!existing.has(name)) {
        state.restaurants.push({ id: uid(), name });
        existing.add(name);
      }
    }
    input.value = '';
    save(); renderRestaurants();
  });

  // 粘贴多行时也能拆分
  $('restaurantInput').addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (/\n/.test(text)) {
      e.preventDefault();
      $('restaurantInput').value = text.replace(/\r?\n/g, '，');
    }
  });

  $('restaurantList').addEventListener('click', (e) => {
    const btn = e.target.closest('.del');
    if (!btn || spinning) return;
    state.restaurants = state.restaurants.filter((r) => r.id !== btn.dataset.id);
    save(); renderRestaurants();
  });

  $('clearRestaurants').addEventListener('click', () => {
    if (spinning || !confirm('确定清空所有饭店吗？')) return;
    state.restaurants = [];
    $('result').textContent = '';
    save(); renderRestaurants();
  });

  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  $('spinBtn').addEventListener('click', () => {
    const list = state.restaurants;
    if (spinning || list.length < 2) return;
    spinning = true;
    $('spinBtn').disabled = true;
    $('result').textContent = '转啊转……';

    const n = list.length;
    const seg = TAU / n;
    const target = Math.floor(Math.random() * n);
    const jitter = (Math.random() * 0.7 + 0.15) * seg; // 不停在分界线上
    // 让目标扇区落在指针下：POINTER - rotation ≡ target*seg + jitter (mod 2π)
    const base = POINTER - target * seg - jitter;
    const startRot = rotation;
    let endRot = base;
    while (endRot < startRot + TAU * 6) endRot += TAU;
    const duration = 4200;
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      rotation = startRot + (endRot - startRot) * easeOut(t);
      drawWheel();
      if (t < 1) return requestAnimationFrame(frame);
      rotation %= TAU;
      spinning = false;
      const picked = list[target].name;
      $('result').innerHTML = `今天吃：<strong>${escapeHtml(picked)}</strong> 🎉
        <br><button class="small" id="recordPicked">去记一笔</button>`;
      $('recordPicked').addEventListener('click', () => {
        switchTab('ledger');
        setType('expense');
        $('txNote').value = picked;
        $('txAmount').focus();
      });
      renderRestaurants();
    }
    requestAnimationFrame(frame);
  });

  // ---------- 记账 ----------
  function setType(type) {
    document.querySelectorAll('input[name="type"]').forEach((r) => { r.checked = r.value === type; });
  }

  function balanceOf(txs) {
    return txs.reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0);
  }

  function renderLedger() {
    const txs = state.transactions.slice().sort((a, b) => (b.date.localeCompare(a.date)) || (b.created - a.created));
    const bal = balanceOf(txs);
    const balEl = $('balance');
    balEl.textContent = fmt(bal);
    balEl.classList.toggle('low', bal < 0);

    // 最近消费的日均，用来估算还能吃几天
    const expenses = txs.filter((t) => t.type === 'expense');
    const days = new Set(expenses.map((t) => t.date));
    const spent = expenses.reduce((s, t) => s + t.amount, 0);
    const avg = days.size ? spent / days.size : 0;
    let sub = '';
    if (bal < 0) sub = `已经透支 ${fmt(-bal)}，该补钱了`;
    else if (avg > 0) sub = `按日均 ${fmt(Math.round(avg))} 计算，大约还够 ${Math.floor(bal / avg)} 天`;
    $('balanceSub').textContent = sub;

    const deposited = txs.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const month = today().slice(0, 7);
    const monthSpent = expenses.filter((t) => t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0);
    $('stats').innerHTML = txs.length ? `
      <span>累计存入 <b>${fmt(deposited)}</b></span>
      <span>累计消费 <b>${fmt(spent)}</b></span>
      <span>本月消费 <b>${fmt(monthSpent)}</b></span>` : '';

    let html = '';
    let lastDate = null;
    for (const t of txs) {
      if (t.date !== lastDate) {
        const dayTotal = txs.filter((x) => x.date === t.date && x.type === 'expense').reduce((s, x) => s + x.amount, 0);
        html += `<li class="day-head"><span>${t.date}</span><span>${dayTotal ? '当天消费 ' + fmt(dayTotal) : ''}</span></li>`;
        lastDate = t.date;
      }
      html += `
        <li>
          <div class="tx-main">
            <div class="tx-note">${escapeHtml(t.note || (t.type === 'deposit' ? '存入' : '消费'))}</div>
          </div>
          <div class="tx-right">
            <span class="tx-amt ${t.type}">${t.type === 'deposit' ? '+' : '-'}${fmt(t.amount)}</span>
            <button class="del" data-id="${t.id}" title="删除">×</button>
          </div>
        </li>`;
    }
    $('txList').innerHTML = html;
    $('txEmpty').style.display = txs.length ? 'none' : '';
  }

  $('txDate').value = today();

  // 页面一直开着时，过了午夜自动把默认日期换成新的一天（用户手动改过日期则不动）
  let curDay = today(), dateDirty = false;
  $('txDate').addEventListener('input', () => { dateDirty = true; });
  function checkDay() {
    const d = today();
    if (d === curDay) return;
    curDay = d;
    if (!dateDirty) $('txDate').value = d;
    renderLedger();
  }
  setInterval(checkDay, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });

  $('txForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = toCents($('txAmount').value);
    if (!Number.isFinite(amount) || amount <= 0) { alert('请输入正确的金额'); return; }
    const type = document.querySelector('input[name="type"]:checked').value;
    state.transactions.push({
      id: uid(),
      type,
      amount,
      date: $('txDate').value || today(),
      note: $('txNote').value.trim(),
      created: Date.now(),
    });
    $('txAmount').value = '';
    $('txNote').value = '';
    dateDirty = false; $('txDate').value = today();
    save(); renderLedger();
  });

  $('txList').addEventListener('click', (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    const tx = state.transactions.find((t) => t.id === btn.dataset.id);
    if (!tx || !confirm(`删除这条记录？\n${tx.date} ${tx.note || ''} ${fmt(tx.amount)}`)) return;
    state.transactions = state.transactions.filter((t) => t.id !== tx.id);
    save(); renderLedger();
  });

  // ---------- 备份 ----------
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `money-lunch-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.restaurants) || !Array.isArray(data.transactions)) throw new Error('格式不对');
      if (!confirm('导入会覆盖当前的饭店列表和全部流水，确定吗？')) return;
      state = { restaurants: data.restaurants, transactions: data.transactions };
      save(); renderRestaurants(); renderLedger();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });

  renderRestaurants();
  renderLedger();
})();
