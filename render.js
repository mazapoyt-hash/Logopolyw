/* ============================================================
   RENDERING
   ============================================================ */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

/* ---- Token / color pickers on lobby screen ---- */
function renderPickers() {
  const tokWrap = document.getElementById('token-picker');
  tokWrap.innerHTML = '';
  TOKEN_ICONS.forEach((icon, i) => {
    const b = document.createElement('button');
    b.className = 'picker-btn' + (i === selectedToken ? ' active' : '');
    b.textContent = icon;
    b.onclick = () => { selectedToken = i; renderPickers(); };
    tokWrap.appendChild(b);
  });
  const colWrap = document.getElementById('color-picker');
  colWrap.innerHTML = '';
  PLAYER_COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'color-swatch' + (i === selectedColorIdx ? ' active' : '');
    b.style.background = c;
    b.onclick = () => { selectedColorIdx = i; renderPickers(); };
    colWrap.appendChild(b);
  });
}

/* ---- Waiting room ---- */
function renderWaiting(s) {
  document.getElementById('room-code-display').textContent = currentRoomCode;
  const list = document.getElementById('waiting-players');
  list.innerHTML = '';
  s.order.forEach(pid => {
    const p = s.players[pid];
    const li = document.createElement('li');
    li.innerHTML = `<span class="tok" style="background:${p.color}">${TOKEN_ICONS[p.token]}</span> ${p.name}${pid === myPid ? ' (вы)' : ''}${pid === s.order[0] ? ' 👑' : ''}`;
    list.appendChild(li);
  });
  const startBtn = document.getElementById('btn-start-game');
  const isHost = s.order[0] === myPid;
  startBtn.classList.toggle('hidden', !isHost);
  startBtn.disabled = Object.keys(s.players).length < 2;
}

/* ---- Board tile grid position (standard 11x11 layout) ---- */
function tilePos(i) {
  if (i === 0) return { row: 11, col: 11 };
  if (i >= 1 && i <= 9) return { row: 11, col: 11 - i };
  if (i === 10) return { row: 11, col: 1 };
  if (i >= 11 && i <= 19) return { row: 11 - (i - 10), col: 1 };
  if (i === 20) return { row: 1, col: 1 };
  if (i >= 21 && i <= 29) return { row: 1, col: 1 + (i - 20) };
  if (i === 30) return { row: 1, col: 11 };
  if (i >= 31 && i <= 39) return { row: 1 + (i - 30), col: 11 };
}

let boardBuilt = false;

function buildBoardOnce() {
  if (boardBuilt) return;
  const grid = document.getElementById('board-grid');
  grid.innerHTML = '';
  BOARD.forEach(tile => {
    const pos = tilePos(tile.i);
    const div = document.createElement('div');
    div.className = 'tile tile-' + tile.type + (tile.i % 10 === 0 ? ' corner' : '');
    div.style.gridRow = pos.row;
    div.style.gridColumn = pos.col;
    div.dataset.idx = tile.i;

    let inner = '';
    if (tile.group) inner += `<div class="tile-color" style="background:${GROUP_COLORS[tile.group]}"></div>`;
    inner += `<div class="tile-name">${tile.name}</div>`;
    if (tile.price) inner += `<div class="tile-price">₽${tile.price}</div>`;
    if (tile.type === 'tax') inner += `<div class="tile-price">₽${tile.amount}</div>`;
    inner += `<div class="tile-houses"></div>`;
    inner += `<div class="tile-owner"></div>`;
    inner += `<div class="tile-tokens"></div>`;
    div.innerHTML = inner;
    div.onclick = () => openTileInfo(tile.i);
    grid.appendChild(div);
  });

  const center = document.createElement('div');
  center.className = 'board-center';
  center.style.gridRow = '2 / 11';
  center.style.gridColumn = '2 / 11';
  center.innerHTML = `
    <div class="logo">MONOPOLY</div>
    <div class="dice-row" id="dice-row">
      <div class="die" id="die1">–</div>
      <div class="die" id="die2">–</div>
    </div>
    <div id="turn-banner" class="turn-banner"></div>
    <div id="log-panel" class="log-panel"></div>
  `;
  grid.appendChild(center);
  boardBuilt = true;
}

/* ---- Full game render ---- */
function renderGame(s) {
  buildBoardOnce();
  renderTopBar(s);
  renderBoardState(s);
  renderDice(s);
  renderTurnBanner(s);
  renderLog(s);
  renderActionBar(s);
  renderTrade(s);
  renderWinner(s);
}

function renderTopBar(s) {
  const bar = document.getElementById('top-bar');
  bar.innerHTML = '';
  s.order.forEach((pid, idx) => {
    const p = s.players[pid];
    const card = document.createElement('div');
    card.className = 'player-card' + (idx === s.turnIndex ? ' active-turn' : '') + (p.bankrupt ? ' bankrupt' : '');
    card.style.setProperty('--pcolor', p.color);
    card.innerHTML = `
      <div class="player-avatar" style="background:${p.color}">${TOKEN_ICONS[p.token]}</div>
      <div class="player-info">
        <div class="player-name">${p.name}${pid === myPid ? ' (вы)' : ''}</div>
        <div class="player-money">₽${p.bankrupt ? 0 : p.money}</div>
      </div>
      ${p.inJail ? '<div class="jail-badge">🔒</div>' : ''}
    `;
    bar.appendChild(card);
  });
}

function renderBoardState(s) {
  document.querySelectorAll('.tile').forEach(div => {
    const idx = div.dataset.idx;
    const prop = s.properties[idx];
    const ownerDiv = div.querySelector('.tile-owner');
    const housesDiv = div.querySelector('.tile-houses');
    const tokensDiv = div.querySelector('.tile-tokens');
    ownerDiv.style.background = prop ? s.players[prop.owner].color : 'transparent';
    ownerDiv.style.opacity = prop ? (prop.mortgaged ? 0.3 : 1) : 0;
    housesDiv.innerHTML = '';
    if (prop && prop.houses > 0) {
      housesDiv.innerHTML = prop.houses === 5 ? '🏨' : '🏠'.repeat(prop.houses);
    }
    tokensDiv.innerHTML = '';
    s.order.forEach(pid => {
      const p = s.players[pid];
      if (!p.bankrupt && String(p.position) === String(idx)) {
        const t = document.createElement('span');
        t.className = 'token-dot';
        t.style.background = p.color;
        t.textContent = TOKEN_ICONS[p.token];
        tokensDiv.appendChild(t);
      }
    });
  });
}

function renderDice(s) {
  const d1 = document.getElementById('die1');
  const d2 = document.getElementById('die2');
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  d1.textContent = s.dice && s.dice[0] ? faces[s.dice[0]] : '–';
  d2.textContent = s.dice && s.dice[1] ? faces[s.dice[1]] : '–';
}

function renderTurnBanner(s) {
  const el = document.getElementById('turn-banner');
  if (s.winner) { el.textContent = ''; return; }
  const cp = s.players[currentPlayerId(s)];
  if (isMyTurn(s)) {
    el.textContent = 'Ваш ход';
    el.className = 'turn-banner mine';
  } else {
    el.textContent = `Ход игрока: ${cp.name}`;
    el.className = 'turn-banner';
  }
}

function renderLog(s) {
  const el = document.getElementById('log-panel');
  const items = (s.log || []).slice(-6).reverse();
  el.innerHTML = items.map(l => `<div class="log-line">${l.text}</div>`).join('');
}

function renderWinner(s) {
  const modal = document.getElementById('winner-modal');
  if (s.winner) {
    modal.classList.remove('hidden');
    document.getElementById('winner-text').textContent = `🏆 ${s.players[s.winner].name} побеждает в игре!`;
  } else {
    modal.classList.add('hidden');
  }
}

/* ---- Bottom action bar ---- */
function renderActionBar(s) {
  const bar = document.getElementById('action-bar');
  const me = s.players[myPid];
  const mine = isMyTurn(s) && me && !me.bankrupt && !s.winner;
  bar.innerHTML = '';

  if (!mine) {
    bar.innerHTML = `<div class="waiting-msg">${s.winner ? 'Игра окончена' : 'Ожидание хода другого игрока…'}</div>`;
    renderStaticButtons(false);
    return;
  }

  if (me.inJail && s.turnPhase === 'idle') {
    bar.innerHTML += `<button class="action-btn primary" onclick="rollDice()">🎲 Бросить (дубль = выход)</button>`;
    bar.innerHTML += `<button class="action-btn" onclick="payJailFine()">Заплатить ₽50</button>`;
    if (me.jailCards > 0) bar.innerHTML += `<button class="action-btn" onclick="useJailCard()">Использовать карту</button>`;
  } else if (s.turnPhase === 'idle') {
    bar.innerHTML += `<button class="action-btn primary" onclick="rollDice()">🎲 Бросить кубики</button>`;
  } else if (s.turnPhase === 'awaiting-buy') {
    const tile = BOARD[me.position];
    bar.innerHTML += `<button class="action-btn primary" onclick="buyCurrentTile()">Купить за ₽${tile.price}</button>`;
    bar.innerHTML += `<button class="action-btn" onclick="skipBuy()">Не покупать</button>`;
  } else if (s.turnPhase === 'moved') {
    bar.innerHTML += `<button class="action-btn primary" onclick="endTurn()">Завершить ход</button>`;
  }
  renderStaticButtons(true);
}

function renderStaticButtons(enabled) {
  const wrap = document.getElementById('static-actions');
  wrap.querySelectorAll('button').forEach(b => b.disabled = !enabled);
}

/* ---- Tile info / build / mortgage popover ---- */
function openTileInfo(idx) {
  const s = latestState;
  const tile = BOARD[idx];
  const modal = document.getElementById('tile-modal');
  const prop = s.properties[idx];
  let html = `<h3>${tile.name}</h3>`;
  if (tile.group) html += `<div class="tile-color-bar" style="background:${GROUP_COLORS[tile.group]}"></div>`;

  if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
    if (tile.price) html += `<p>Цена покупки: ₽${tile.price}</p>`;
    if (tile.rent) {
      html += `<table class="rent-table">
        <tr><td>Аренда</td><td>₽${tile.rent[0]}</td></tr>
        <tr><td>С 1 домом</td><td>₽${tile.rent[1]}</td></tr>
        <tr><td>С 2 домами</td><td>₽${tile.rent[2]}</td></tr>
        <tr><td>С 3 домами</td><td>₽${tile.rent[3]}</td></tr>
        <tr><td>С 4 домами</td><td>₽${tile.rent[4]}</td></tr>
        <tr><td>С отелем</td><td>₽${tile.rent[5]}</td></tr>
      </table>`;
    }
    if (prop) {
      html += `<p>Владелец: <b style="color:${s.players[prop.owner].color}">${s.players[prop.owner].name}</b>${prop.mortgaged ? ' (заложено)' : ''}</p>`;
      if (prop.owner === myPid) {
        html += '<div class="modal-actions">';
        if (tile.type === 'property') {
          html += `<button class="action-btn" onclick="buildHouse(${idx});closeModal();">Построить дом (₽${tile.houseCost})</button>`;
          html += `<button class="action-btn" onclick="sellHouse(${idx});closeModal();">Продать дом</button>`;
        }
        html += `<button class="action-btn" onclick="toggleMortgage(${idx});closeModal();">${prop.mortgaged ? 'Выкупить залог' : 'Заложить'}</button>`;
        html += '</div>';
      }
    } else {
      html += `<p>Свободно</p>`;
    }
  } else {
    html += `<p>${tile.type === 'tax' ? 'Налоговая клетка' : ''}</p>`;
  }

  document.getElementById('tile-modal-body').innerHTML = html;
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('tile-modal').classList.add('hidden');
}

/* ---- Trade modal ---- */
function openTradeModal() {
  const s = latestState;
  const others = s.order.filter(pid => pid !== myPid && !s.players[pid].bankrupt);
  if (others.length === 0) { alert('Нет других игроков для сделки'); return; }
  const sel = document.getElementById('trade-target');
  sel.innerHTML = others.map(pid => `<option value="${pid}">${s.players[pid].name}</option>`).join('');
  renderTradeProps();
  document.getElementById('trade-modal').classList.remove('hidden');
}

function renderTradeProps() {
  const s = latestState;
  const targetPid = document.getElementById('trade-target').value;
  const myProps = Object.keys(s.properties).filter(k => s.properties[k].owner === myPid);
  const theirProps = Object.keys(s.properties).filter(k => s.properties[k].owner === targetPid);

  document.getElementById('trade-my-props').innerHTML = myProps.map(idx =>
    `<label><input type="checkbox" value="${idx}" class="my-prop-cb"> ${BOARD[idx].name}</label>`).join('') || '<i>нет собственности</i>';
  document.getElementById('trade-their-props').innerHTML = theirProps.map(idx =>
    `<label><input type="checkbox" value="${idx}" class="their-prop-cb"> ${BOARD[idx].name}</label>`).join('') || '<i>нет собственности</i>';
}

function submitTrade() {
  const targetPid = document.getElementById('trade-target').value;
  const offerMoney = parseInt(document.getElementById('trade-offer-money').value) || 0;
  const requestMoney = parseInt(document.getElementById('trade-request-money').value) || 0;
  const offerProps = Array.from(document.querySelectorAll('.my-prop-cb:checked')).map(cb => cb.value);
  const requestProps = Array.from(document.querySelectorAll('.their-prop-cb:checked')).map(cb => cb.value);
  proposeTrade(targetPid, offerMoney, offerProps, requestMoney, requestProps);
  document.getElementById('trade-modal').classList.add('hidden');
}

function renderTrade(s) {
  const box = document.getElementById('trade-incoming');
  if (s.pendingTrade && s.pendingTrade.to === myPid) {
    const t = s.pendingTrade;
    const from = s.players[t.from];
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="trade-card">
        <b>${from.name}</b> предлагает сделку:
        <div>Отдаёт: ₽${t.offerMoney} ${t.offerProps.map(i => BOARD[i].name).join(', ')}</div>
        <div>Просит: ₽${t.requestMoney} ${t.requestProps.map(i => BOARD[i].name).join(', ')}</div>
        <button class="action-btn primary" onclick="respondTrade(true)">Принять</button>
        <button class="action-btn" onclick="respondTrade(false)">Отклонить</button>
      </div>`;
  } else if (s.pendingTrade && s.pendingTrade.from === myPid) {
    box.classList.remove('hidden');
    box.innerHTML = `<div class="trade-card">Ожидание ответа от ${s.players[s.pendingTrade.to].name}… <button class="action-btn" onclick="cancelTrade()">Отменить</button></div>`;
  } else {
    box.classList.add('hidden');
    box.innerHTML = '';
  }
}
