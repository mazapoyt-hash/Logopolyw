/* ============================================================
   MONOPOLY ONLINE — game engine + Firebase realtime sync
   ============================================================ */

let firebaseApp, db, roomRef, roomListener;
let myPid = localStorage.getItem('mono_pid');
if (!myPid) {
  myPid = 'p_' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('mono_pid', myPid);
}
let myName = localStorage.getItem('mono_name') || '';
let currentRoomCode = null;
let latestState = null;
let selectedToken = 0;
let selectedColorIdx = 0;

/* ---------------- Firebase bootstrap ---------------- */

function initFirebase() {
  if (firebaseApp) return true;
  if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes('YOUR_')) {
    showConfigWarning();
    return false;
  }
  firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.database();
  return true;
}

function showConfigWarning() {
  document.getElementById('config-warning').classList.remove('hidden');
}

/* ---------------- Room helpers ---------------- */

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function freshState(hostPid, hostName, hostToken, hostColor) {
  return {
    createdAt: Date.now(),
    started: false,
    order: [hostPid],
    turnIndex: 0,
    doublesCount: 0,
    turnPhase: 'idle',
    dice: [0, 0],
    lastRoll: null,
    winner: null,
    pendingTrade: null,
    log: [{ text: `${hostName} создал комнату`, ts: Date.now() }],
    players: {
      [hostPid]: mkPlayer(hostName, hostToken, hostColor)
    },
    properties: {}
  };
}

function mkPlayer(name, token, color) {
  return {
    name, token, color,
    money: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailCards: 0,
    bankrupt: false
  };
}

// Firebase Realtime Database prunes empty objects/arrays on write, so an
// empty `properties: {}` (e.g. right after room creation) can come back as
// `undefined`. Normalize on every read so the rest of the code can safely
// assume these fields always exist.
function normalizeState(s) {
  if (!s) return s;
  s.properties = s.properties || {};
  s.order = s.order || [];
  s.players = s.players || {};
  s.log = s.log || [];
  s.dice = s.dice || [0, 0];
  return s;
}

function updateRoom(mutator) {
  if (!roomRef) return Promise.resolve();
  return roomRef.transaction(current => {
    if (current === null) return current;
    normalizeState(current);
    mutator(current);
    return current;
  });
}

function log(state, text) {
  state.log = state.log || [];
  state.log.push({ text, ts: Date.now() });
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

/* ---------------- Create / Join ---------------- */

function createRoom() {
  if (!initFirebase()) return;
  const name = document.getElementById('input-name').value.trim() || 'Игрок';
  myName = name;
  localStorage.setItem('mono_name', name);
  const code = randomRoomCode();
  currentRoomCode = code;
  roomRef = db.ref('rooms/' + code);
  const state = freshState(myPid, myName, selectedToken, PLAYER_COLORS[selectedColorIdx]);
  roomRef.set(state).then(() => {
    attachRoomListener();
    showScreen('screen-waiting');
  });
}

function joinRoom() {
  if (!initFirebase()) return;
  const name = document.getElementById('input-name').value.trim() || 'Игрок';
  const code = document.getElementById('input-code').value.trim().toUpperCase();
  if (!code) { alert('Введите код комнаты'); return; }
  myName = name;
  localStorage.setItem('mono_name', name);
  currentRoomCode = code;
  roomRef = db.ref('rooms/' + code);
  roomRef.get().then(snap => {
    if (!snap.exists()) { alert('Комната не найдена'); roomRef = null; return; }
    const state = normalizeState(snap.val());
    if (state.started) { alert('Игра уже началась в этой комнате'); roomRef = null; return; }
    if (state.players[myPid]) {
      attachRoomListener();
      showScreen('screen-waiting');
      return;
    }
    updateRoom(s => {
      if (s.started) return;
      const usedColors = Object.values(s.players).map(p => p.color);
      let color = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[selectedColorIdx];
      s.players[myPid] = mkPlayer(myName, selectedToken, color);
      s.order.push(myPid);
      log(s, `${myName} присоединился к игре`);
    }).then(() => {
      attachRoomListener();
      showScreen('screen-waiting');
    });
  });
}

function attachRoomListener() {
  if (roomListener) roomRef.off('value', roomListener);
  roomListener = snap => {
    latestState = normalizeState(snap.val());
    if (!latestState) return;
    if (latestState.started) {
      showScreen('screen-game');
      renderGame(latestState);
    } else {
      renderWaiting(latestState);
    }
  };
  roomRef.on('value', roomListener);
}

function leaveRoom() {
  if (roomRef && latestState && latestState.players[myPid] && !latestState.started) {
    updateRoom(s => {
      delete s.players[myPid];
      s.order = s.order.filter(id => id !== myPid);
    });
  }
  if (roomRef && roomListener) roomRef.off('value', roomListener);
  roomRef = null;
  currentRoomCode = null;
  latestState = null;
  showScreen('screen-lobby');
}

function startGame() {
  updateRoom(s => {
    if (Object.keys(s.players).length < 2) return;
    s.started = true;
    s.turnIndex = 0;
    log(s, 'Игра началась! Удачи всем 🎲');
  });
}

/* ---------------- Turn / dice logic ---------------- */

function isMyTurn(s) {
  return s.order[s.turnIndex] === myPid;
}

function currentPlayerId(s) { return s.order[s.turnIndex]; }

function rollDice() {
  updateRoom(s => {
    if (s.order[s.turnIndex] !== myPid) return;
    if (s.turnPhase !== 'idle') return;
    const p = s.players[myPid];
    if (p.bankrupt) return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    s.dice = [d1, d2];
    const isDouble = d1 === d2;

    if (p.inJail) {
      if (isDouble) {
        p.inJail = false;
        p.jailTurns = 0;
        log(s, `${p.name} выбросил дубль и вышел из тюрьмы!`);
        movePlayer(s, myPid, d1 + d2);
      } else {
        p.jailTurns = (p.jailTurns || 0) + 1;
        log(s, `${p.name} не выбросил дубль в тюрьме (попытка ${p.jailTurns}/3)`);
        if (p.jailTurns >= 3) {
          p.money -= 50;
          p.inJail = false;
          p.jailTurns = 0;
          log(s, `${p.name} заплатил ₽50 и вышел из тюрьмы`);
          movePlayer(s, myPid, d1 + d2);
        } else {
          s.turnPhase = 'moved';
        }
      }
      checkBankruptcy(s, myPid);
      return;
    }

    if (isDouble) {
      s.doublesCount = (s.doublesCount || 0) + 1;
      if (s.doublesCount >= 3) {
        log(s, `${p.name} выбросил 3 дубля подряд и отправляется в тюрьму!`);
        sendToJail(s, myPid);
        s.doublesCount = 0;
        s.turnPhase = 'moved';
        return;
      }
    } else {
      s.doublesCount = 0;
    }

    movePlayer(s, myPid, d1 + d2);
    checkBankruptcy(s, myPid);
  });
}

function movePlayer(s, pid, steps) {
  const p = s.players[pid];
  const before = p.position;
  let after = (before + steps) % 40;
  if (after < 0) after += 40;
  if (after < before) {
    p.money += 200;
    log(s, `${p.name} прошёл СТАРТ и получил ₽200`);
  }
  p.position = after;
  resolveTile(s, pid, after);
}

function resolveTile(s, pid, idx) {
  const p = s.players[pid];
  const tile = BOARD[idx];
  s.turnPhase = 'moved';

  if (tile.type === 'go') { /* nothing extra */ }

  else if (tile.type === 'tax') {
    p.money -= tile.amount;
    log(s, `${p.name} заплатил налог ₽${tile.amount}`);
  }

  else if (tile.type === 'gotojail') {
    sendToJail(s, pid);
  }

  else if (tile.type === 'parking' || tile.type === 'jail') {
    /* nothing */
  }

  else if (tile.type === 'chance' || tile.type === 'chest') {
    drawCard(s, pid, tile.type);
  }

  else if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
    const prop = s.properties[idx];
    if (!prop || !prop.owner) {
      s.turnPhase = 'awaiting-buy';
    } else if (prop.owner !== pid && !prop.mortgaged) {
      const rent = computeRent(s, idx);
      p.money -= rent;
      s.players[prop.owner].money += rent;
      log(s, `${p.name} заплатил аренду ₽${rent} игроку ${s.players[prop.owner].name}`);
    }
  }
}

function computeRent(s, idx) {
  const tile = BOARD[idx];
  const prop = s.properties[idx];
  const owner = prop.owner;

  if (tile.type === 'railroad') {
    const count = Object.keys(s.properties).filter(k => {
      const t = BOARD[k]; const pr = s.properties[k];
      return t.type === 'railroad' && pr.owner === owner;
    }).length;
    return [0, 25, 50, 100, 200][count] || 0;
  }

  if (tile.type === 'utility') {
    const count = Object.keys(s.properties).filter(k => {
      const t = BOARD[k]; const pr = s.properties[k];
      return t.type === 'utility' && pr.owner === owner;
    }).length;
    const diceSum = (s.dice[0] || 1) + (s.dice[1] || 1);
    return diceSum * (count >= 2 ? 10 : 4);
  }

  // regular property
  if (prop.houses === 5) return tile.rent[5]; // hotel
  if (prop.houses > 0) return tile.rent[prop.houses];

  const ownsFullGroup = groupFullyOwned(s, tile.group, owner);
  return ownsFullGroup ? tile.rent[0] * 2 : tile.rent[0];
}

function groupFullyOwned(s, group, pid) {
  const tiles = BOARD.filter(t => t.group === group);
  return tiles.every(t => s.properties[t.i] && s.properties[t.i].owner === pid);
}

function sendToJail(s, pid) {
  const p = s.players[pid];
  p.position = 10;
  p.inJail = true;
  p.jailTurns = 0;
  log(s, `${p.name} отправляется в тюрьму`);
}

function drawCard(s, pid, kind) {
  const deck = kind === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  const card = deck[Math.floor(Math.random() * deck.length)];
  const p = s.players[pid];
  log(s, `${p.name}: ${card.text}`);
  const a = card.action;

  if (a.type === 'move') {
    const before = p.position;
    p.position = a.to;
    if (a.to < before) { p.money += 200; log(s, `${p.name} прошёл СТАРТ и получил ₽200`); }
    resolveTile(s, pid, a.to);
    return;
  }
  if (a.type === 'moverel') {
    let np = p.position + a.by;
    if (np < 0) np += 40;
    np = np % 40;
    p.position = np;
    resolveTile(s, pid, np);
    return;
  }
  if (a.type === 'pay') { p.money -= a.amount; }
  if (a.type === 'collect') { p.money += a.amount; }
  if (a.type === 'pay_each') {
    s.order.forEach(id => {
      if (id !== pid && !s.players[id].bankrupt) {
        s.players[id].money += a.amount;
        p.money -= a.amount;
      }
    });
  }
  if (a.type === 'collect_each') {
    s.order.forEach(id => {
      if (id !== pid && !s.players[id].bankrupt) {
        s.players[id].money -= a.amount;
        p.money += a.amount;
      }
    });
  }
  if (a.type === 'gotojail') { sendToJail(s, pid); }
  if (a.type === 'jailcard') { p.jailCards = (p.jailCards || 0) + 1; }
  if (a.type === 'nearest') {
    const candidates = BOARD.filter(t => t.type === a.kind).map(t => t.i);
    let target = candidates.find(i => i > p.position);
    if (target === undefined) target = candidates[0];
    const before = p.position;
    p.position = target;
    if (target < before) { p.money += 200; }
    resolveTile(s, pid, target);
  }
  if (a.type === 'repairs') {
    let total = 0;
    Object.keys(s.properties).forEach(k => {
      const pr = s.properties[k];
      if (pr.owner === pid) {
        if (pr.houses === 5) total += a.hotel;
        else total += (pr.houses || 0) * a.house;
      }
    });
    p.money -= total;
    log(s, `${p.name} заплатил ₽${total} за ремонт`);
  }
}

/* ---------------- Buy / skip ---------------- */

function buyCurrentTile() {
  updateRoom(s => {
    if (s.order[s.turnIndex] !== myPid) return;
    if (s.turnPhase !== 'awaiting-buy') return;
    const p = s.players[myPid];
    const idx = p.position;
    const tile = BOARD[idx];
    if (p.money < tile.price) return;
    p.money -= tile.price;
    s.properties[idx] = { owner: myPid, houses: 0, mortgaged: false };
    log(s, `${p.name} купил ${tile.name} за ₽${tile.price}`);
    s.turnPhase = 'moved';
  });
}

function skipBuy() {
  updateRoom(s => {
    if (s.order[s.turnIndex] !== myPid) return;
    if (s.turnPhase !== 'awaiting-buy') return;
    s.turnPhase = 'moved';
    log(s, `${s.players[myPid].name} отказался от покупки`);
  });
}

/* ---------------- End turn ---------------- */

function endTurn() {
  updateRoom(s => {
    if (s.order[s.turnIndex] !== myPid) return;
    if (s.turnPhase !== 'moved') return;
    const p = s.players[myPid];
    checkBankruptcy(s, myPid);

    if (p.money >= 0 && s.doublesCount > 0 && !p.inJail && !p.bankrupt) {
      // rolled a double and not in jail -> go again
      s.turnPhase = 'idle';
      return;
    }
    s.doublesCount = 0;
    advanceTurn(s);
  });
}

function advanceTurn(s) {
  const n = s.order.length;
  let next = s.turnIndex;
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n;
    const pid = s.order[next];
    if (!s.players[pid].bankrupt) break;
  }
  s.turnIndex = next;
  s.turnPhase = 'idle';
  s.dice = [0, 0];

  const remaining = s.order.filter(id => !s.players[id].bankrupt);
  if (remaining.length === 1) {
    s.winner = remaining[0];
    log(s, `🏆 ${s.players[remaining[0]].name} победил!`);
  }
}

function checkBankruptcy(s, pid) {
  const p = s.players[pid];
  if (p.money < 0 && !p.bankrupt) {
    // try auto-mortgaging to cover debt before declaring bankrupt (simple auto-resolve)
    const owned = Object.keys(s.properties).filter(k => s.properties[k].owner === pid);
    for (const k of owned) {
      if (p.money >= 0) break;
      const pr = s.properties[k];
      if (!pr.mortgaged && pr.houses === 0) {
        pr.mortgaged = true;
        p.money += BOARD[k].mortgage;
        log(s, `${p.name} заложил ${BOARD[k].name}, чтобы покрыть долг`);
      }
    }
  }
  if (p.money < 0) {
    p.bankrupt = true;
    // release properties back to bank
    Object.keys(s.properties).forEach(k => {
      if (s.properties[k].owner === pid) delete s.properties[k];
    });
    log(s, `💥 ${p.name} обанкротился и выбывает из игры`);
    const remaining = s.order.filter(id => !s.players[id].bankrupt);
    if (remaining.length === 1) {
      s.winner = remaining[0];
      log(s, `🏆 ${s.players[remaining[0]].name} победил!`);
    }
  }
}

/* ---------------- Jail: pay / use card ---------------- */

function payJailFine() {
  updateRoom(s => {
    if (s.order[s.turnIndex] !== myPid) return;
    const p = s.players[myPid];
    if (!p.inJail || s.turnPhase !== 'idle') return;
    p.money -= 50;
    p.inJail = false;
    p.jailTurns = 0;
    log(s, `${p.name} заплатил ₽50 и вышел из тюрьмы`);
    checkBankruptcy(s, myPid);
  });
}

function useJailCard() {
  updateRoom(s => {
    if (s.order[s.turnIndex] !== myPid) return;
    const p = s.players[myPid];
    if (!p.inJail || !p.jailCards) return;
    p.jailCards -= 1;
    p.inJail = false;
    p.jailTurns = 0;
    log(s, `${p.name} использовал карту освобождения из тюрьмы`);
  });
}

/* ---------------- Build / sell / mortgage ---------------- */

function buildHouse(idx) {
  updateRoom(s => {
    const p = s.players[myPid];
    const tile = BOARD[idx];
    const prop = s.properties[idx];
    if (!prop || prop.owner !== myPid || tile.type !== 'property') return;
    if (!groupFullyOwned(s, tile.group, myPid)) return;
    if (prop.houses >= 5) return;
    if (prop.mortgaged) return;
    // even build rule (simplified): can't build if another prop in group has 2+ fewer houses
    const groupTiles = BOARD.filter(t => t.group === tile.group);
    const minHouses = Math.min(...groupTiles.map(t => (s.properties[t.i] ? s.properties[t.i].houses : 0)));
    if (prop.houses > minHouses) return;
    if (p.money < tile.houseCost) return;
    p.money -= tile.houseCost;
    prop.houses += 1;
    log(s, `${p.name} построил ${prop.houses === 5 ? 'отель' : 'дом'} на ${tile.name}`);
  });
}

function sellHouse(idx) {
  updateRoom(s => {
    const p = s.players[myPid];
    const tile = BOARD[idx];
    const prop = s.properties[idx];
    if (!prop || prop.owner !== myPid || prop.houses <= 0) return;
    const groupTiles = BOARD.filter(t => t.group === tile.group);
    const maxHouses = Math.max(...groupTiles.map(t => (s.properties[t.i] ? s.properties[t.i].houses : 0)));
    if (prop.houses < maxHouses) return;
    prop.houses -= 1;
    p.money += Math.floor(tile.houseCost / 2);
    log(s, `${p.name} продал дом на ${tile.name}`);
  });
}

function toggleMortgage(idx) {
  updateRoom(s => {
    const p = s.players[myPid];
    const tile = BOARD[idx];
    const prop = s.properties[idx];
    if (!prop || prop.owner !== myPid) return;
    if (!prop.mortgaged) {
      if (prop.houses > 0) return;
      prop.mortgaged = true;
      p.money += tile.mortgage;
      log(s, `${p.name} заложил ${tile.name} за ₽${tile.mortgage}`);
    } else {
      const cost = Math.ceil(tile.mortgage * 1.1);
      if (p.money < cost) return;
      p.money -= cost;
      prop.mortgaged = false;
      log(s, `${p.name} выкупил ${tile.name} за ₽${cost}`);
    }
  });
}

/* ---------------- Trade ---------------- */

function proposeTrade(toPid, offerMoney, offerProps, requestMoney, requestProps) {
  updateRoom(s => {
    s.pendingTrade = {
      from: myPid, to: toPid,
      offerMoney: offerMoney || 0, offerProps: offerProps || [],
      requestMoney: requestMoney || 0, requestProps: requestProps || [],
      status: 'pending'
    };
    log(s, `${s.players[myPid].name} предложил сделку игроку ${s.players[toPid].name}`);
  });
}

function respondTrade(accept) {
  updateRoom(s => {
    const t = s.pendingTrade;
    if (!t || t.to !== myPid) return;
    if (accept) {
      const from = s.players[t.from], to = s.players[t.to];
      if (from.money < t.offerMoney || to.money < t.requestMoney) { s.pendingTrade = null; return; }
      from.money -= t.offerMoney; to.money += t.offerMoney;
      to.money -= t.requestMoney; from.money += t.requestMoney;
      t.offerProps.forEach(idx => { if (s.properties[idx]) s.properties[idx].owner = t.to; });
      t.requestProps.forEach(idx => { if (s.properties[idx]) s.properties[idx].owner = t.from; });
      log(s, `Сделка между ${from.name} и ${to.name} состоялась`);
    } else {
      log(s, `${s.players[myPid].name} отклонил сделку`);
    }
    s.pendingTrade = null;
  });
}

function cancelTrade() {
  updateRoom(s => {
    if (s.pendingTrade && s.pendingTrade.from === myPid) s.pendingTrade = null;
  });
}
