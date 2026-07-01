/* ═══════════════════════════════════════════════════
   RECYCLE-DIGI — Complete Frontend App
   Single JS file: API, State, Render, Events
   With Cart, Orders, Buy Now, Auction support
═══════════════════════════════════════════════════ */

'use strict';

// ── STATE ──────────────────────────────────────────
const S = {
  user:        null,
  token:       localStorage.getItem('rd_token') || null,
  currentView: 'home',
  homeFilters: { endingSoon: false, sellType: '' },
  homePage:    1,
  currentAuction: null,
  editingAuctionId: null,
  bidAuctionId: null,
  currentChatId: null,
  sellImages:   [],
  cartCount:    0,
};

// ── API CLIENT ─────────────────────────────────────
const API = '/api';

async function req(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && S.token) headers['Authorization'] = 'Bearer ' + S.token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const api = {
  get:    (p, a)    => req('GET',    p, null, a),
  post:   (p, b, a) => req('POST',   p, b, a),
  put:    (p, b, a) => req('PUT',    p, b, a),
  delete: (p, a)    => req('DELETE', p, null, a),

  auth: {
    register: d => api.post('/auth/register', d, false),
    login:    d => api.post('/auth/login',    d, false),
    me:       () => api.get('/auth/me'),
    update:   d => api.put('/auth/me', d),
    changePw: d => api.put('/auth/change-password', d),
  },
  auctions: {
    list:   p  => api.get('/auctions?' + new URLSearchParams(p), false),
    get:    id => api.get('/auctions/' + id),
    create: d  => api.post('/auctions', d),
    update: (id, d) => api.put('/auctions/' + id, d),
    delete: id => api.delete('/auctions/' + id),
    mine:   () => api.get('/auctions/seller/mine'),
  },
  bids: {
    place: d  => api.post('/bids', d),
    my:    () => api.get('/bids/my'),
  },
  watchlist: {
    toggle: id => api.post('/watchlist/toggle', { auctionId: id }),
    get:    () => api.get('/watchlist'),
  },
  chat: {
    list:    () => api.get('/chat'),
    thread:  id => api.get('/chat/' + id),
    send:    (id, text) => api.post('/chat/' + id + '/message', { text }),
    open:    id => api.post('/chat/open', { auctionId: id }),
  },
  notifs: {
    get:     () => api.get('/notifications'),
    readAll: () => api.put('/notifications/read-all'),
  },
  cart: {
    add:     (auctionId) => api.post('/cart/add', { auctionId }),
    get:     () => api.get('/cart'),
    update:  (id, quantity) => api.put('/cart/' + id, { quantity }),
    remove:  (id) => api.delete('/cart/' + id),
    clear:   () => api.delete('/cart/clear'),
  },
  orders: {
    checkout: (d) => api.post('/orders/checkout', d),
    my:       () => api.get('/orders'),
    seller:   () => api.get('/orders/seller'),
    updateStatus: (id, status) => api.put('/orders/' + id + '/status', { status }),
  },
  upload: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(API + '/upload', { method:'POST', headers:{ Authorization:'Bearer '+S.token }, body:fd });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message);
    return d;
  },
};

// ── HELPERS ────────────────────────────────────────
const taka = n => '৳' + parseFloat(n||0).toLocaleString('en-BD');

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)   return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400)return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function fmtDate(d) {
  return new Date(d).toLocaleString('en-BD', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function loading(btnEl, on) {
  if (on) { btnEl._orig = btnEl.innerHTML; btnEl.innerHTML = '<span class="spinner"></span>'; btnEl.disabled = true; }
  else     { btnEl.innerHTML = btnEl._orig || btnEl.innerHTML; btnEl.disabled = false; }
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

// ── CITY → AREA DYNAMIC DROPDOWN ───────────────────
const CITY_AREAS = {
  Dhaka:      ['Gulshan','Dhanmondi','Mirpur','Uttara','Banani','Bashundhara','Mohammadpur','Motijheel','Tejgaon','Farmgate'],
  Chittagong: ['Agrabad','Nasirabad','GEC Circle','Halishahar','Pahartali','Khulshi','Chandgaon','Panchlaish'],
  Rajshahi:   ['Shaheb Bazar','Boalia','Rajpara','Motihar','Kazla','Binodpur','Sapura'],
  Khulna:     ['KDA Avenue','Sonadanga','Khalishpur','Daulatpur','Gallamari','Boyra','Shibbari'],
  Sylhet:     ['Zindabazar','Amberkhana','Bandar Bazar','Subidbazar','Shahjalal','Tilagor','Mirabazar'],
};

function updateAreaOptions(cityId, areaId) {
  const city  = document.getElementById(cityId).value;
  const areaEl = document.getElementById(areaId);
  const areas = CITY_AREAS[city] || [];
  areaEl.innerHTML = '<option value="">— Any area —</option>' +
    areas.map(a => `<option>${a}</option>`).join('');
}

// ── COUNTDOWN TIMERS ───────────────────────────────
const activeTimers = {};

function startCountdown(el, endsAt) {
  if (!el) return;
  const id = 'cd_' + Math.random();
  el.dataset.timerId = id;

  function tick() {
    const diff = new Date(endsAt) - Date.now();
    if (diff <= 0) {
      el.innerHTML = '<span style="color:var(--muted);font-size:11px">Ended</span>';
      clearInterval(activeTimers[id]);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    if (d > 0) {
      el.innerHTML = `<span class="cd-compact">⏰ ${d}d ${h}h ${m}m</span>`;
    } else if (h > 0) {
      el.innerHTML = `<span class="cd-compact">⏰ ${h}h ${m}m ${s}s</span>`;
    } else {
      el.innerHTML = `<span class="cd-compact cd-urgent">⏰ ${m}m ${s}s</span>`;
    }
  }
  tick();
  activeTimers[id] = setInterval(tick, 1000);
}

function clearAllTimers() {
  Object.keys(activeTimers).forEach(k => { clearInterval(activeTimers[k]); delete activeTimers[k]; });
}

// ── NAVIGATION ─────────────────────────────────────
function nav(view, queryStr = '') {
  clearAllTimers();

  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));

  S.currentView = view;

  const viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');

  const nl = document.getElementById('nl-' + view);
  if (nl) nl.classList.add('active');

  // Scroll to top
  window.scrollTo(0, 0);

  // Load view data
  const params = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};

  switch (view) {
    case 'home':        loadHome(params); break;
    case 'auctions':    loadHome(params); break;
    case 'detail':      break; // called separately
    case 'sell':        initSellForm(); break;
    case 'dashboard':   requireAuth(() => loadDashboard()); break;
    case 'watchlist':   requireAuth(() => loadWatchlist()); break;
    case 'bids':        requireAuth(() => loadMyBids()); break;
    case 'chats':       requireAuth(() => loadChats()); break;
    case 'notifications': requireAuth(() => loadNotifsFull()); break;
    case 'cart':        requireAuth(() => loadCart()); break;
    case 'orders':      requireAuth(() => loadOrders()); break;
    case 'seller-orders': requireAuth(() => loadSellerOrders()); break;
  }

  // Apply any filter params to home
  if (params.category) document.getElementById('home-cat').value = params.category;
  if (params.city)     document.getElementById('home-city').value = params.city;
  if (params.endingSoon) { S.homeFilters.endingSoon = true; document.getElementById('ending-toggle').classList.add('active'); }
}

function requireAuth(fn) {
  if (!S.user) { openAuth('login'); return; }
  fn();
}

// ── AUTH ───────────────────────────────────────────
function openAuth(tab) {
  openModal('auth-modal');
  // Switch to the requested tab
  const btns = document.querySelectorAll('#auth-modal .auth-tab');
  btns.forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#auth-modal .form-section').forEach(f => f.classList.remove('active'));
  const targetBtn = tab === 'login' ? btns[0] : btns[1];
  if (targetBtn) targetBtn.classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

function switchAuthTab(tab, btn) {
  document.querySelectorAll('#auth-modal .auth-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#auth-modal .form-section').forEach(f => f.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

async function doLogin() {
  const email    = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-pass').value;
  if (!email || !password) { showAlert('login-alert', 'Email and password required.'); return; }
  const btn = document.getElementById('login-btn');
  loading(btn, true);
  try {
    const d = await api.auth.login({ email, password });
    S.token = d.token;
    S.user  = d.user;
    localStorage.setItem('rd_token', d.token);
    localStorage.setItem('rd_user', JSON.stringify(d.user));
    closeModal('auth-modal');
    updateAuthUI();
    toast('Welcome back, ' + d.user.username + '! 👋');
    loadNotifCount();
    loadCartCount();
  } catch (e) {
    loading(btn, false);
    showAlert('login-alert', e.message);
  }
}

async function doRegister() {
  const username = document.getElementById('r-username').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const pass     = document.getElementById('r-pass').value;
  const pass2    = document.getElementById('r-pass2').value;
  const fullName = document.getElementById('r-fullname').value.trim();
  const phone    = document.getElementById('r-phone').value.trim();

  if (!username || !email || !pass) { showAlert('reg-alert', 'Username, email and password are required.'); return; }
  if (pass !== pass2)               { showAlert('reg-alert', 'Passwords do not match.'); return; }
  if (pass.length < 6)              { showAlert('reg-alert', 'Password must be at least 6 characters.'); return; }

  const btn = document.getElementById('reg-btn');
  loading(btn, true);
  try {
    const d = await api.auth.register({ username, email, password: pass, fullName, phone });
    S.token = d.token;
    S.user  = d.user;
    localStorage.setItem('rd_token', d.token);
    localStorage.setItem('rd_user', JSON.stringify(d.user));
    closeModal('auth-modal');
    updateAuthUI();
    toast('Account created! Welcome, ' + d.user.username + '! 🎉');
  } catch (e) {
    loading(btn, false);
    showAlert('reg-alert', e.message);
  }
}

function logout() {
  S.token = null; S.user = null; S.cartCount = 0;
  localStorage.removeItem('rd_token');
  localStorage.removeItem('rd_user');
  updateAuthUI();
  updateCartBadge();
  nav('home');
  toast('Logged out successfully.', 'info');
}

function updateAuthUI() {
  const u = S.user;
  document.getElementById('tb-user').style.display  = u ? '' : 'none';
  document.getElementById('tb-guest').style.display = u ? 'none' : '';
  document.getElementById('header-login-btn').style.display = u ? 'none' : '';
  document.getElementById('header-user-btn').style.display = u ? '' : 'none';

  if (u) {
    document.getElementById('tb-name').textContent = u.username;
    document.getElementById('header-uname').textContent = u.username;
    document.getElementById('header-avatar').textContent = (u.username || '?')[0].toUpperCase();
    // Dashboard visible for all logged-in users
    const dashLink = document.getElementById('nl-dashboard');
    if (dashLink) dashLink.style.display = '';
  } else {
    document.getElementById('nl-dashboard').style.display = 'none';
  }
}

// ── SELLTYPE FILTER ────────────────────────────────
function setSellTypeFilter(val) {
  S.homeFilters.sellType = val;
  document.querySelectorAll('.selltype-pill').forEach(p => p.classList.remove('active'));
  const pillId = val === 'DIRECT' ? 'st-direct' : val === 'AUCTION' ? 'st-auction' : 'st-all';
  document.getElementById(pillId).classList.add('active');
  S.homePage = 1;
  loadHome();
}

// ── AUCTION CARD RENDERER ──────────────────────────
function auctionCard(a, showHeart = true, idx = 0) {
  const endsAt    = new Date(a.endsAt);
  const isEnding  = (endsAt - Date.now()) < 48 * 3600000 && a.status === 'ACTIVE';
  const bidCount  = a._count?.bids ?? 0;
  const watchIds  = JSON.parse(localStorage.getItem('rd_watch') || '[]');
  const hearted   = watchIds.includes(a.id);
  const isDirect  = a.sellType === 'DIRECT';
  const isNew     = a.condition === 'NEW';

  const priceLabel = isDirect ? 'Price' : 'Current Price';
  const priceVal   = isDirect ? a.basePrice : (a.currentMaxBid || a.basePrice);

  const actionBtn = isDirect
    ? `<button class="btn btn-primary btn-sm btn-card-action" onclick="event.stopPropagation();addToCart('${a.id}')">🛒 Buy Now</button>`
    : `<span class="bid-count">🔒 ${bidCount} sealed bid${bidCount !== 1 ? 's' : ''}</span>`;

  return `
  <div class="auction-card" style="--i:${idx}" onclick="openDetail('${a.id}')">
    <div class="card-img-wrap">
      <img src="${a.images?.[0] || '/placeholder.svg'}" alt="${a.title}" onerror="this.src='/placeholder.svg'">
      ${showHeart ? `<button class="heart-btn ${hearted ? 'hearted' : ''}" onclick="event.stopPropagation();toggleWatch('${a.id}',this)">${hearted ? '❤️' : '🤍'}</button>` : ''}
    </div>
    <div class="card-body">
      <div class="card-meta-row">
        <span class="card-cond-pill ${isNew ? 'is-new' : 'is-used'}">${isNew ? '✨ New' : '♻️ Used'}</span>
        <span class="card-sell-pill ${isDirect ? 'is-direct' : 'is-auction'}">${isDirect ? '🛒 Buy Now' : '🔨 Auction'}</span>
      </div>
      <div class="card-title">${a.title}</div>
      <div class="card-price-block">
        <div class="card-base">${priceLabel}</div>
        <div class="card-bid"><span class="symbol">৳</span>${parseFloat(priceVal).toLocaleString('en-BD')}</div>
      </div>
      <div class="card-footer">
        ${actionBtn}
        ${!isDirect ? `<div class="countdown" id="cd-${a.id}"></div>` : ''}
      </div>
    </div>
  </div>`;
}

// Start countdowns after rendering cards
function startCardCountdowns(auctions) {
  auctions.forEach(a => {
    const el = document.getElementById('cd-' + a.id);
    if (el) startCountdown(el, a.endsAt);
  });
}

// ── LOAD HOME / AUCTIONS ───────────────────────────
async function loadHome(extraParams = {}) {
  const grid = document.getElementById('home-auctions');
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1"><span class="spinner"></span> Loading...</div>';

  const sortVal   = document.getElementById('home-sort')?.value || 'endsAt|asc';
  const [sort, order] = sortVal.split('|');

  const params = {
    page:  S.homePage,
    limit: 12,
    sort, order,
    ...(document.getElementById('home-cat')?.value  && { category:  document.getElementById('home-cat').value }),
    ...(document.getElementById('home-cond')?.value && { condition: document.getElementById('home-cond').value }),
    ...(document.getElementById('home-city')?.value && { city:      document.getElementById('home-city').value }),
    ...(document.getElementById('home-area')?.value && { area:      document.getElementById('home-area').value }),
    ...(S.homeFilters.endingSoon && { endingSoon: 'true' }),
    ...(S.homeFilters.sellType && { sellType: S.homeFilters.sellType }),
    ...extraParams,
  };

  try {
    const d = await api.auctions.list(params);
    document.getElementById('home-result-count').textContent = `${d.total} item${d.total !== 1 ? 's' : ''} found`;

    if (!d.auctions.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="ico">🔍</div><h3>No items found</h3><p>Try adjusting your filters</p></div>';
      return;
    }

    grid.innerHTML = d.auctions.map((a, i) => auctionCard(a, true, i)).join('');
    startCardCountdowns(d.auctions);
    renderPagination('home-pagination', d.page, d.pages, (p) => { S.homePage = p; loadHome(); });

    // Update hero stats
    document.getElementById('hs-auctions').textContent = d.total;
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="ico">⚠️</div><h3>Failed to load</h3><p>${e.message}</p></div>`;
  }
}

function applyHomeFilters() { S.homePage = 1; loadHome(); }

function clearFilters() {
  document.getElementById('home-cat').value  = '';
  document.getElementById('home-cond').value = '';
  document.getElementById('home-city').value = '';
  document.getElementById('home-area').value = '';
  document.getElementById('home-sort').value = 'endsAt|asc';
  S.homeFilters.endingSoon = false;
  S.homeFilters.sellType = '';
  document.getElementById('ending-toggle').classList.remove('active');
  document.querySelectorAll('.selltype-pill').forEach(p => p.classList.remove('active'));
  document.getElementById('st-all').classList.add('active');
  S.homePage = 1;
  loadHome();
}

function toggleEndingSoon() {
  S.homeFilters.endingSoon = !S.homeFilters.endingSoon;
  document.getElementById('ending-toggle').classList.toggle('active', S.homeFilters.endingSoon);
  S.homePage = 1;
  loadHome();
}

function doSearch() {
  const q   = document.getElementById('search-input').value.trim();
  const cat = document.getElementById('search-cat').value;
  if (!q && !cat) return;
  document.getElementById('home-cat').value = cat || '';
  nav('home');
  S.homePage = 1;
  loadHome({ ...(q && { search: q }) });
}

// ── AUCTION DETAIL ─────────────────────────────────
async function openDetail(id) {
  nav('detail');
  document.getElementById('d-title').textContent = 'Loading...';
  document.getElementById('detail-content').innerHTML = '<div class="loading" style="grid-column:1/-1;padding:80px"><span class="spinner"></span> Loading...</div>';

  try {
    const d = await api.auctions.get(id);
    const a = d.auction;
    S.currentAuction = a;

    document.getElementById('d-bc').textContent = a.title.substring(0, 40) + '...';
    document.getElementById('d-title').textContent      = a.title;

    const isActive  = a.status === 'ACTIVE';
    const isSeller  = S.user?.id === a.sellerId;
    const isDirect  = a.sellType === 'DIRECT';
    const minBid    = (a.currentMaxBid || a.basePrice) + a.bidIncrement;
    const bidCount  = d.bids.length;
    const watchIds  = JSON.parse(localStorage.getItem('rd_watch') || '[]');
    const hearted   = watchIds.includes(a.id);

    // Gallery
    const imgs = a.images?.length ? a.images : ['/placeholder.svg'];
    const thumbs = imgs.map((img, i) =>
      `<div class="thumb-img ${i===0?'active':''}" onclick="swapDetailImg(this,'${img}')"><img src="${img}" onerror="this.src='/placeholder.svg'"></div>`
    ).join('');

    // Bid history (only for auction type)
    const bidsHtml = !isDirect ? (
      d.bids.length
        ? d.bids.slice(0, 8).map(b => `
            <div class="bid-item">
              <span class="bid-user">@${b.username}</span>
              ${b.isSealed
                ? '<span class="bid-amount" style="color:var(--muted)">🔒 Sealed</span>'
                : `<span class="bid-amount">${taka(b.amount)}</span>`}
              <span class="bid-time">${timeAgo(b.createdAt)}</span>
            </div>`).join('')
        : '<div class="sealed-note">No bids yet. Be the first!</div>'
    ) : '';

    // Sell type badge
    const sellTypeBadge = isDirect
      ? '<span class="card-selltype st-direct" style="display:inline-block;margin-bottom:12px;font-size:13px;padding:6px 14px">🛒 Buy Now — Direct Sale</span>'
      : '<span class="card-selltype st-auction" style="display:inline-block;margin-bottom:12px;font-size:13px;padding:6px 14px">🔨 Auction — Sealed Bidding</span>';

    // Action button
    let actionHtml = '';
    if (isActive && !isSeller) {
      if (isDirect) {
        actionHtml = `
          <button class="btn btn-primary btn-block" style="margin-bottom:10px" onclick="addToCart('${a.id}')">
            🛒 Add to Cart — ${taka(a.basePrice)}
          </button>`;
      } else {
        actionHtml = `
          <button class="btn btn-primary btn-block" style="margin-bottom:10px" onclick="openBidModal('${a.id}',${minBid})">
            🔒 Place Sealed Bid — Min ${taka(minBid)}
          </button>`;
      }
    }

    document.getElementById('detail-content').innerHTML = `
      <div>
        <div class="gallery-main" id="gallery-main">
          <img src="${imgs[0]}" id="gallery-main-img" onerror="this.src='/placeholder.svg'" alt="${a.title}">
        </div>
        <div class="gallery-thumbs">${thumbs}</div>
        <div style="margin-top:22px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Description</h3>
          <p style="font-size:13px;color:#555;line-height:1.9">${a.description}</p>
          <div style="margin-top:16px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--muted)">
            <span>📂 <strong>${a.category}</strong></span>
            <span>🏷️ <strong>${a.condition}</strong></span>
            <span>📦 <strong>${isDirect ? 'Buy Now' : 'Auction'}</strong></span>
            <span>📍 <strong>${a.city}${a.area ? ', '+a.area : ''}</strong></span>
            <span>👁️ <strong>${a.viewCount}</strong> views</span>
            <span>📅 Listed <strong>${timeAgo(a.createdAt)}</strong></span>
            <span>🧑 Seller: <strong>@${a.seller.username}</strong></span>
          </div>
        </div>
      </div>
      <div>
        <div class="detail-panel">
          ${sellTypeBadge}
          <div class="detail-cat">${a.category} · ${a.condition}</div>
          <div class="detail-prices">
            <div class="base-lbl">${isDirect ? 'Price' : 'Base / Starting Price'}</div>
            <div class="base-val">${taka(a.basePrice)}</div>
            ${!isDirect ? `
            <div class="bid-lbl">Current Highest Bid</div>
            <div class="bid-val">${taka(a.currentMaxBid || a.basePrice)}</div>
            <div class="bid-count-lbl">🔒 ${bidCount} sealed bid${bidCount!==1?'s':''}</div>` : ''}
          </div>

          ${isActive ? `
          <div class="detail-countdown">
            <h4>⏰ Time Remaining</h4>
            <div id="detail-countdown"></div>
          </div>` : `<div class="alert alert-info" style="margin-bottom:14px">Listing ${a.status.toLowerCase()}</div>`}

          ${d.userBid ? `<div class="alert alert-success" style="margin-bottom:12px">✅ Your current bid: <strong>${taka(d.userBid.amount)}</strong></div>` : ''}

          ${actionHtml}

          ${isSeller && a.status !== 'ACTIVE' && !isDirect ? `
          <button class="btn btn-green btn-block" style="margin-bottom:10px" onclick="openChatWithWinner('${a.id}')">
            💬 Open Winner Chat
          </button>` : ''}

          ${isSeller ? `
          <div style="display:flex;gap:8px;margin-bottom:10px">
            <button class="btn btn-outline btn-sm" style="flex:1" onclick="openEditModal('${a.id}')">✏️ Edit</button>
            <button class="btn btn-red btn-sm" style="flex:1" onclick="deleteAuction('${a.id}')">🗑️ Delete</button>
          </div>` : ''}

          <button class="btn btn-outline btn-block" style="margin-bottom:10px" onclick="toggleWatch('${a.id}',this,'detail')" id="detail-watch-btn">
            ${hearted ? '❤️ Remove from Watchlist' : '🤍 Add to Watchlist'}
          </button>

          ${!isDirect ? `
          <div class="bid-history">
            <h4>Bid History</h4>
            <div class="sealed-note" style="margin-bottom:8px">🔒 All bids are sealed — amounts hidden until auction ends</div>
            ${bidsHtml}
          </div>` : ''}
        </div>
      </div>`;

    if (isActive) {
      const cdEl = document.getElementById('detail-countdown');
      if (cdEl) startCountdown(cdEl, a.endsAt);
    }
  } catch (e) {
    document.getElementById('detail-content').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="ico">⚠️</div><h3>Failed to load</h3><p>${e.message}</p></div>`;
  }
}

function swapDetailImg(el, src) {
  document.getElementById('gallery-main-img').src = src;
  document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ── BID ────────────────────────────────────────────
function openBidModal(auctionId, minBid) {
  if (!S.user) { openAuth('login'); return; }
  S.bidAuctionId = auctionId;
  const a = S.currentAuction;
  document.getElementById('bid-modal-info').innerHTML = `
    <strong>${a?.title || 'Auction'}</strong><br>
    Base price: ${taka(a?.basePrice || 0)} · Current max: ${taka(a?.currentMaxBid || a?.basePrice || 0)}`;
  document.getElementById('bid-min-hint').textContent = `Minimum bid: ${taka(minBid)} (current + ৳${a?.bidIncrement || 50} increment)`;
  document.getElementById('bid-amount-input').value = minBid;
  document.getElementById('bid-amount-input').min   = minBid;
  document.getElementById('bid-alert').innerHTML = '';
  openModal('bid-modal');
}

async function submitBid() {
  const amount = parseFloat(document.getElementById('bid-amount-input').value);
  if (!amount || amount <= 0) { showAlert('bid-alert', 'Please enter a valid bid amount.'); return; }
  const btn = document.getElementById('bid-submit-btn');
  loading(btn, true);
  try {
    await api.bids.place({ auctionId: S.bidAuctionId, amount });
    closeModal('bid-modal');
    toast('🔒 Sealed bid placed successfully!');
    openDetail(S.bidAuctionId); // Refresh detail
  } catch (e) {
    loading(btn, false);
    showAlert('bid-alert', e.message);
  }
}

// ── CART ───────────────────────────────────────────
async function addToCart(auctionId) {
  if (!S.user) { openAuth('login'); return; }
  try {
    await api.cart.add(auctionId);
    toast('🛒 Added to cart!');
    loadCartCount();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadCartCount() {
  if (!S.user) { S.cartCount = 0; updateCartBadge(); return; }
  try {
    const d = await api.cart.get();
    S.cartCount = d.items ? d.items.length : (d.cartItems ? d.cartItems.length : 0);
  } catch { S.cartCount = 0; }
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = S.cartCount;
    badge.style.display = S.cartCount > 0 ? 'flex' : 'none';
  }
}

async function loadCart() {
  const el = document.getElementById('cart-content');
  el.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  try {
    const d = await api.cart.get();
    const items = d.items || d.cartItems || [];
    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><div class="ico">🛒</div><h3>Cart is empty</h3><p>Browse items and add them to your cart.</p><button class="btn btn-primary" style="margin-top:16px" onclick="nav(\'home\')">Browse Items</button></div>';
      return;
    }

    let total = 0;
    const rows = items.map(item => {
      const a = item.auction || item;
      const price = a.basePrice || 0;
      const qty = item.quantity || 1;
      total += price * qty;
      return `
      <div style="display:flex;align-items:center;gap:16px;padding:14px;border-bottom:1px solid var(--border)">
        <img src="${a.images?.[0] || '/placeholder.svg'}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;cursor:pointer" onclick="openDetail('${a.id}')" onerror="this.src='/placeholder.svg'">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text-1);cursor:pointer" onclick="openDetail('${a.id}')">${a.title}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${a.category} · ${a.condition}</div>
          <div style="font-size:14px;font-weight:700;color:var(--taka);margin-top:4px">${taka(price)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="updateCartQty('${item.id}',${qty - 1})">−</button>
          <span style="font-weight:600;min-width:20px;text-align:center">${qty}</span>
          <button class="btn btn-outline btn-sm" onclick="updateCartQty('${item.id}',${qty + 1})">+</button>
        </div>
        <div style="font-weight:700;font-size:14px;min-width:80px;text-align:right">${taka(price * qty)}</div>
        <button class="btn btn-red btn-sm" onclick="removeFromCart('${item.id}')">✕</button>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-size:15px;font-weight:700;color:var(--text-1)">${items.length} item${items.length>1?'s':''} in cart</h3>
          <button class="btn btn-outline btn-sm" onclick="clearCart()">🗑️ Clear Cart</button>
        </div>
        ${rows}
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-top:16px">
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-bottom:16px">
          <span>Total</span><span style="color:var(--taka)">${taka(total)}</span>
        </div>
        <button class="btn btn-primary btn-block btn-lg" onclick="openCheckout()">📦 Proceed to Checkout</button>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function updateCartQty(itemId, qty) {
  if (qty < 1) { removeFromCart(itemId); return; }
  try {
    await api.cart.update(itemId, qty);
    loadCart();
  } catch (e) { toast(e.message, 'error'); }
}

async function removeFromCart(itemId) {
  try {
    await api.cart.remove(itemId);
    toast('Removed from cart');
    loadCartCount();
    loadCart();
  } catch (e) { toast(e.message, 'error'); }
}

async function clearCart() {
  if (!confirm('Clear all items from cart?')) return;
  try {
    await api.cart.clear();
    toast('Cart cleared');
    S.cartCount = 0;
    updateCartBadge();
    loadCart();
  } catch (e) { toast(e.message, 'error'); }
}

function openCheckout() {
  if (!S.user) { openAuth('login'); return; }
  document.getElementById('co-address').value = '';
  document.getElementById('co-phone').value = S.user.phone || '';
  document.getElementById('co-note').value = '';
  document.getElementById('checkout-alert').innerHTML = '';
  document.getElementById('checkout-summary').innerHTML = 'You will receive order confirmation after placing the order.';
  openModal('checkout-modal');
}

async function placeOrder() {
  const address = document.getElementById('co-address').value.trim();
  const phone   = document.getElementById('co-phone').value.trim();
  const note    = document.getElementById('co-note').value.trim();
  if (!address) { showAlert('checkout-alert', 'Delivery address is required.'); return; }
  if (!phone)   { showAlert('checkout-alert', 'Phone number is required.'); return; }

  const btn = document.getElementById('checkout-btn');
  loading(btn, true);
  try {
    await api.orders.checkout({ address, phone, note });
    closeModal('checkout-modal');
    S.cartCount = 0;
    updateCartBadge();
    toast('🎉 Order placed successfully!');
    nav('orders');
  } catch (e) {
    loading(btn, false);
    showAlert('checkout-alert', e.message);
  }
}

// ── ORDERS ─────────────────────────────────────────
const ORDER_STATUSES = ['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'];
const STATUS_COLORS = { PENDING:'s-ending', CONFIRMED:'s-active', SHIPPED:'s-active', DELIVERED:'s-ended', CANCELLED:'s-closed' };

function orderCard(o, isSeller = false) {
  const a = o.auction || {};
  const statusCls = STATUS_COLORS[o.status] || 's-ending';

  let actions = '';
  if (isSeller && o.status !== 'DELIVERED' && o.status !== 'CANCELLED') {
    const nextStatuses = ORDER_STATUS_FLOW[o.status] || [];
    actions = nextStatuses.map(s =>
      `<button class="btn btn-outline btn-sm" onclick="updateOrderStatus('${o.id}','${s}')">${STATUS_LABELS[s]}</button>`
    ).join('');
  }

  return `
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:16px">
      <img src="${a.images?.[0] || '/placeholder.svg'}" style="width:56px;height:56px;border-radius:8px;object-fit:cover" onerror="this.src='/placeholder.svg'">
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;color:var(--text-1)">${a.title || 'Item'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">
          ${taka(o.totalAmount || o.amount || a.basePrice)} · Qty: ${o.quantity || 1} · ${fmtDate(o.createdAt)}
        </div>
        ${o.address ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">📍 ${o.address}</div>` : ''}
        ${isSeller && o.buyer ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">👤 Buyer: @${o.buyer.username || o.buyer.email || 'N/A'}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="status-badge ${statusCls}">${o.status}</span>
        <div style="display:flex;gap:4px">${actions}</div>
      </div>
    </div>
  </div>`;
}

const ORDER_STATUS_FLOW = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
};

const STATUS_LABELS = {
  PENDING: '⏳ Pending',
  CONFIRMED: '✅ Confirm',
  SHIPPED: '🚚 Ship',
  DELIVERED: '📦 Delivered',
  CANCELLED: '❌ Cancel',
};

async function loadOrders() {
  const el = document.getElementById('orders-content');
  el.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  try {
    const d = await api.orders.my();
    const orders = d.orders || [];
    if (!orders.length) {
      el.innerHTML = '<div class="empty-state"><div class="ico">📦</div><h3>No orders yet</h3><p>Buy items directly to place orders.</p><button class="btn btn-primary" style="margin-top:16px" onclick="nav(\'home\')">Browse Items</button></div>';
      return;
    }
    el.innerHTML = orders.map(o => orderCard(o)).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function loadSellerOrders() {
  const el = document.getElementById('seller-orders-content');
  el.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  try {
    const d = await api.orders.seller();
    const orders = d.orders || [];
    if (!orders.length) {
      el.innerHTML = '<div class="empty-state"><div class="ico">📬</div><h3>No orders received</h3><p>Orders from your direct sale items will appear here.</p></div>';
      return;
    }
    el.innerHTML = orders.map(o => orderCard(o, true)).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await api.orders.updateStatus(orderId, status);
    toast('Order status updated to ' + status);
    // Reload whichever view is active
    if (S.currentView === 'seller-orders') loadSellerOrders();
    else if (S.currentView === 'orders') loadOrders();
    else if (S.currentView === 'dashboard') loadDashboardOrders();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadDashboardOrders() {
  // Load my orders in dashboard tab
  const myEl = document.getElementById('dash-my-orders');
  const sellEl = document.getElementById('dash-seller-orders');

  if (myEl) {
    myEl.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    try {
      const d = await api.orders.my();
      const orders = d.orders || [];
      myEl.innerHTML = orders.length
        ? orders.map(o => orderCard(o)).join('')
        : '<div class="empty-state" style="padding:20px"><p>No orders yet.</p></div>';
    } catch (e) { myEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  }

  if (sellEl) {
    sellEl.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    try {
      const d = await api.orders.seller();
      const orders = d.orders || [];
      sellEl.innerHTML = orders.length
        ? orders.map(o => orderCard(o, true)).join('')
        : '<div class="empty-state" style="padding:20px"><p>No orders received yet.</p></div>';
    } catch (e) { sellEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  }
}

// ── WATCHLIST ──────────────────────────────────────
async function toggleWatch(auctionId, btn, context) {
  if (!S.user) { openAuth('login'); return; }
  try {
    const d = await api.watchlist.toggle(auctionId);
    const watchIds = JSON.parse(localStorage.getItem('rd_watch') || '[]');
    if (d.action === 'added') {
      if (!watchIds.includes(auctionId)) watchIds.push(auctionId);
      toast('❤️ Added to watchlist');
      if (context === 'detail') btn.textContent = '❤️ Remove from Watchlist';
      else { btn.classList.add('hearted'); btn.textContent = '❤️'; }
    } else {
      const idx = watchIds.indexOf(auctionId);
      if (idx > -1) watchIds.splice(idx, 1);
      toast('Removed from watchlist');
      if (context === 'detail') btn.textContent = '🤍 Add to Watchlist';
      else { btn.classList.remove('hearted'); btn.textContent = '🤍'; }
    }
    localStorage.setItem('rd_watch', JSON.stringify(watchIds));
  } catch (e) { toast(e.message, 'error'); }
}

async function loadWatchlist() {
  const grid = document.getElementById('watchlist-grid');
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1"><span class="spinner"></span></div>';
  try {
    const d = await api.watchlist.get();
    if (!d.watchlist.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="ico">❤️</div><h3>No saved auctions</h3><p>Tap the heart on any auction to save it here.</p></div>';
      return;
    }
    grid.innerHTML = d.watchlist.map((a, i) => auctionCard(a, true, i)).join('');
    startCardCountdowns(d.watchlist);
  } catch (e) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>${e.message}</p></div>`; }
}

// ── MY BIDS ────────────────────────────────────────
async function loadMyBids() {
  const el = document.getElementById('bids-list');
  el.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  try {
    const d = await api.bids.my();
    if (!d.bids.length) {
      el.innerHTML = '<div class="empty-state"><div class="ico">💰</div><h3>No bids placed yet</h3><p>Browse auctions and place your first sealed bid!</p><button class="btn btn-primary" style="margin-top:16px" onclick="nav(\'home\')">Browse Items</button></div>';
      return;
    }
    el.innerHTML = d.bids.map(b => `
      <div class="auction-list-item" onclick="openDetail('${b.auction.id}')" style="cursor:pointer">
        <img class="ali-img" src="${b.auction.images?.[0] || '/placeholder.svg'}" onerror="this.src='/placeholder.svg'">
        <div class="ali-info">
          <div class="ali-title">${b.auction.title}</div>
          <div class="ali-meta">
            <span>Your bid: <strong style="color:var(--taka)">${taka(b.amount)}</strong></span>
            <span>Max bid: <strong>${taka(b.auction.currentMaxBid)}</strong></span>
            <span>Category: ${b.auction.category}</span>
            <span>Placed ${timeAgo(b.createdAt)}</span>
          </div>
        </div>
        <div>
          ${b.isWinning ? '<span class="status-badge s-active">🏆 Won</span>' : ''}
          <span class="status-badge s-${b.auction.status.toLowerCase()}">${b.auction.status}</span>
          ${b.auction.status === 'ACTIVE' ? `<div id="bid-cd-${b.auction.id}" style="margin-top:6px;font-size:11px"></div>` : ''}
        </div>
      </div>`).join('');

    // Start countdowns for active auctions
    d.bids.filter(b => b.auction.status === 'ACTIVE').forEach(b => {
      const el2 = document.getElementById('bid-cd-' + b.auction.id);
      if (el2) startCountdown(el2, b.auction.endsAt);
    });
  } catch (e) { el.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
}

// ── SELLER DASHBOARD ───────────────────────────────
async function loadDashboard() {
  if (!S.user) return;
  document.getElementById('dash-username').textContent = S.user.username;
  document.getElementById('dash-role').textContent = S.user.role;
  document.getElementById('p-fullname').value = S.user.fullName || '';
  document.getElementById('p-phone').value    = S.user.phone    || '';

  try {
    const d = await api.auctions.mine();
    const stats = d.stats;

    document.getElementById('ds-total').textContent  = stats.total;
    document.getElementById('ds-active').textContent = stats.active;
    document.getElementById('ds-bids').textContent   = stats.totalBids;
    document.getElementById('ds-views').textContent  = stats.totalViews;

    // Recent (up to 3)
    const recent = d.auctions.slice(0, 3);
    document.getElementById('dash-recent').innerHTML = recent.length
      ? recent.map(a => auctionListItem(a)).join('')
      : '<div class="empty-state" style="padding:20px"><p>No listings yet.</p></div>';

    // All auctions
    document.getElementById('dash-all-auctions').innerHTML = d.auctions.length
      ? d.auctions.map(a => auctionListItem(a, true)).join('')
      : '<div class="empty-state" style="padding:30px"><div class="ico">🏷️</div><h3>No listings yet</h3><button class="btn btn-primary btn-sm" onclick="openSellForm()">Create First Listing</button></div>';
  } catch (e) { toast(e.message, 'error'); }

  // Load orders for dashboard tabs
  loadDashboardOrders();
}

function auctionListItem(a, showActions = false) {
  const bidCount  = a._count?.bids ?? 0;
  const watchCount= a._count?.watchlist ?? 0;
  const isDirect  = a.sellType === 'DIRECT';
  return `
  <div class="auction-list-item">
    <img class="ali-img" src="${a.images?.[0] || '/placeholder.svg'}" onerror="this.src='/placeholder.svg'" onclick="openDetail('${a.id}')" style="cursor:pointer">
    <div class="ali-info">
      <div class="ali-title" onclick="openDetail('${a.id}')" style="cursor:pointer">${a.title}
        <span style="font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;${isDirect?'background:#e8f5e9;color:#2e7d32':'background:#fff3e0;color:#e65100'}">${isDirect?'🛒 Buy Now':'🔨 Auction'}</span>
      </div>
      <div class="ali-meta">
        <span>Base: <strong>${taka(a.basePrice)}</strong></span>
        ${!isDirect ? `<span>Max bid: <strong style="color:var(--taka)">${taka(a.currentMaxBid || a.basePrice)}</strong></span>` : ''}
        ${!isDirect ? `<span>🔒 ${bidCount} bids</span>` : ''}
        <span>❤️ ${watchCount} saves</span>
        <span>👁️ ${a.viewCount} views</span>
        <span>Ends: ${fmtDate(a.endsAt)}</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="status-badge s-${a.status.toLowerCase()}">${a.status}</span>
      ${showActions ? `
      <button class="btn btn-sm btn-outline" onclick="openEditModal('${a.id}')">✏️ Edit</button>
      ${a.status !== 'ACTIVE' && bidCount > 0 && !isDirect ? `<button class="btn btn-sm btn-green" onclick="openChatWithWinner('${a.id}')">💬 Contact Winner</button>` : ''}
      <button class="btn btn-sm btn-red" onclick="deleteAuction('${a.id}')">🗑️</button>` : ''}
    </div>
  </div>`;
}

function showDashTab(tab, el) {
  document.querySelectorAll('.dash-tab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.dash-nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById('dtab-' + tab).style.display = 'block';
  if (el) el.classList.add('active');
  if (tab === 'my-auctions') loadDashboard();
  if (tab === 'my-orders' || tab === 'seller-orders') loadDashboardOrders();
}

async function saveProfile() {
  try {
    const d = await api.auth.update({
      fullName: document.getElementById('p-fullname').value.trim(),
      phone:    document.getElementById('p-phone').value.trim(),
    });
    S.user = { ...S.user, ...d.user };
    localStorage.setItem('rd_user', JSON.stringify(S.user));
    showAlert('profile-alert', 'Profile updated!', 'success');
    toast('Profile saved ✅');
  } catch (e) { showAlert('profile-alert', e.message); }
}

async function changePassword() {
  const old  = document.getElementById('pw-old').value;
  const nw   = document.getElementById('pw-new').value;
  const nw2  = document.getElementById('pw-new2').value;
  if (!old || !nw)  { showAlert('pw-alert', 'All fields required.'); return; }
  if (nw !== nw2)   { showAlert('pw-alert', 'Passwords do not match.'); return; }
  if (nw.length < 6){ showAlert('pw-alert', 'Min 6 characters.'); return; }
  try {
    await api.auth.changePw({ oldPassword: old, newPassword: nw });
    showAlert('pw-alert', 'Password updated!', 'success');
    document.getElementById('pw-old').value = document.getElementById('pw-new').value = document.getElementById('pw-new2').value = '';
    toast('Password changed ✅');
  } catch (e) { showAlert('pw-alert', e.message); }
}

// ── SELL FORM ──────────────────────────────────────
function openSellForm() {
  if (!S.user) { openAuth('login'); return; }
  nav('sell');
}

function initSellForm() {
  S.sellImages = [];
  document.getElementById('image-previews').innerHTML = '';
  document.getElementById('sell-alert').innerHTML = '';
  // Set default end time to 48h from now
  const def = new Date(Date.now() + 48 * 3600000);
  def.setSeconds(0, 0);
  document.getElementById('s-ends').value = def.toISOString().slice(0, 16);
  // Reset all fields
  ['s-title','s-desc','s-base','s-increment','s-img-url'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 's-increment' ? '50' : '';
  });
  // Reset condition and sellType
  document.getElementById('s-cond').value = 'USED';
  document.getElementById('s-selltype').value = 'AUCTION';
  onConditionChange();
}

function onConditionChange() {
  const cond = document.getElementById('s-cond').value;
  const selltypeGroup = document.getElementById('selltype-group');
  if (cond === 'NEW') {
    // NEW items are always DIRECT, hide sellType selector
    selltypeGroup.style.display = 'none';
    document.getElementById('s-selltype').value = 'DIRECT';
    // Hide bid increment
    document.getElementById('increment-group').style.display = 'none';
  } else {
    // USED: show sellType selector
    selltypeGroup.style.display = '';
    onSellTypeChange();
  }
}

function onSellTypeChange() {
  const selltype = document.getElementById('s-selltype').value;
  const incrementGroup = document.getElementById('increment-group');
  if (selltype === 'DIRECT') {
    incrementGroup.style.display = 'none';
  } else {
    incrementGroup.style.display = '';
  }
}

async function handleImageUpload(input) {
  const files = Array.from(input.files).slice(0, 5 - S.sellImages.length);
  for (const file of files) {
    try {
      const d = await api.upload(file);
      S.sellImages.push(d.url);
      addImagePreview(d.url);
      toast('Image uploaded ✅');
    } catch (e) { toast('Upload failed: ' + e.message, 'error'); }
  }
}

function addImageUrl() {
  const url = document.getElementById('s-img-url').value.trim();
  if (!url) return;
  if (S.sellImages.length >= 5) { toast('Max 5 images.', 'warning'); return; }
  S.sellImages.push(url);
  addImagePreview(url);
  document.getElementById('s-img-url').value = '';
}

function addImagePreview(url) {
  const idx = S.sellImages.indexOf(url);
  const div = document.createElement('div');
  div.style.cssText = 'position:relative;width:72px;height:72px';
  div.innerHTML = `
    <img src="${url}" style="width:72px;height:72px;border-radius:3px;object-fit:cover;border:1px solid var(--border)" onerror="this.src='/placeholder.svg'">
    <button onclick="removeImage(${idx},this.parentElement)" style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>`;
  document.getElementById('image-previews').appendChild(div);
}

function removeImage(idx, el) {
  S.sellImages.splice(idx, 1);
  el.remove();
}

async function submitAuction() {
  const title       = document.getElementById('s-title').value.trim();
  const description = document.getElementById('s-desc').value.trim();
  const category    = document.getElementById('s-cat').value;
  const condition   = document.getElementById('s-cond').value;
  const sellType    = condition === 'NEW' ? 'DIRECT' : document.getElementById('s-selltype').value;
  const basePrice   = parseFloat(document.getElementById('s-base').value);
  const bidIncrement= sellType === 'DIRECT' ? 0 : (parseFloat(document.getElementById('s-increment').value) || 50);
  const city        = document.getElementById('s-city').value;
  const area        = document.getElementById('s-area').value;
  const endsAt      = document.getElementById('s-ends').value;

  if (!title || !description || !category || !basePrice || !endsAt) {
    showAlert('sell-alert', 'Please fill in all required fields.');
    return;
  }
  if (new Date(endsAt) <= new Date()) {
    showAlert('sell-alert', 'End date must be in the future.');
    return;
  }
  if (!S.sellImages.length) {
    showAlert('sell-alert', 'Please add at least one image.');
    return;
  }

  const btn = document.getElementById('sell-btn');
  loading(btn, true);
  try {
    const d = await api.auctions.create({ title, description, images: S.sellImages, category, condition, sellType, basePrice, bidIncrement, city, area, endsAt });
    toast('🎉 ' + (sellType === 'DIRECT' ? 'Item listed for direct sale!' : 'Auction listed successfully!'));
    S.sellImages = [];
    openDetail(d.auction.id);
  } catch (e) {
    loading(btn, false);
    showAlert('sell-alert', e.message);
  }
}

// ── EDIT AUCTION ───────────────────────────────────
function openEditModal(auctionId) {
  S.editingAuctionId = auctionId;
  const a = S.currentAuction;
  if (a) {
    document.getElementById('e-title').value     = a.title || '';
    document.getElementById('e-desc').value      = a.description || '';
    document.getElementById('e-base').value      = a.basePrice || '';
    document.getElementById('e-increment').value = a.bidIncrement || 50;
    document.getElementById('e-city').value      = a.city || 'Dhaka';
    const endsLocal = new Date(a.endsAt);
    endsLocal.setMinutes(endsLocal.getMinutes() - endsLocal.getTimezoneOffset());
    document.getElementById('e-ends').value = endsLocal.toISOString().slice(0, 16);
  }
  document.getElementById('edit-alert').innerHTML = '';
  openModal('edit-modal');
}

async function saveEdit() {
  const btn = document.getElementById('edit-save-btn');
  loading(btn, true);
  try {
    await api.auctions.update(S.editingAuctionId, {
      title:        document.getElementById('e-title').value.trim(),
      description:  document.getElementById('e-desc').value.trim(),
      basePrice:    parseFloat(document.getElementById('e-base').value),
      bidIncrement: parseFloat(document.getElementById('e-increment').value),
      city:         document.getElementById('e-city').value,
      endsAt:       document.getElementById('e-ends').value,
    });
    closeModal('edit-modal');
    toast('Listing updated ✅');
    openDetail(S.editingAuctionId);
  } catch (e) {
    loading(btn, false);
    showAlert('edit-alert', e.message);
  }
}

async function deleteAuction(id) {
  if (!confirm('Delete this listing? This cannot be undone.')) return;
  try {
    await api.auctions.delete(id);
    toast('Listing deleted.');
    nav('dashboard');
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

// ── CHAT ───────────────────────────────────────────
async function loadChats() {
  const listEl = document.getElementById('chat-list-items');
  listEl.innerHTML = '<div class="loading" style="padding:16px;font-size:12px"><span class="spinner"></span></div>';
  try {
    const d = await api.chat.list();
    if (!d.chats.length) {
      listEl.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--muted)">No conversations yet.<br>Win an auction or contact a winner.</div>';
      return;
    }
    listEl.innerHTML = d.chats.map(c => {
      const lastMsg = c.messages?.[0];
      const other   = c.seller.id === S.user?.id ? c.winner : c.seller;
      return `
      <div class="chat-item" onclick="openChatThread('${c.id}')" id="ci-${c.id}">
        <div class="chat-item-title">@${other.username}</div>
        <div class="chat-item-meta">📦 ${c.auction.title.substring(0,30)}... · ${taka(c.auction.currentMaxBid)}</div>
        ${lastMsg ? `<div class="chat-item-preview">${lastMsg.sender?.username === S.user?.id ? 'You: ' : ''}${lastMsg.text}</div>` : '<div class="chat-item-preview" style="color:var(--muted);font-style:italic">No messages yet</div>'}
      </div>`;
    }).join('');
  } catch (e) { listEl.innerHTML = `<div style="padding:14px;font-size:12px;color:var(--red)">${e.message}</div>`; }
}

async function openChatThread(chatId) {
  S.currentChatId = chatId;
  document.querySelectorAll('.chat-item').forEach(c => c.classList.remove('active'));
  const ci = document.getElementById('ci-' + chatId);
  if (ci) ci.classList.add('active');

  const threadEl = document.getElementById('chat-thread');
  threadEl.innerHTML = '<div class="loading" style="flex:1"><span class="spinner"></span></div>';

  try {
    const d = await api.chat.thread(chatId);
    const other = d.chat.seller.id === S.user?.id ? d.chat.winner : d.chat.seller;

    threadEl.innerHTML = `
      <div class="chat-thread-head">
        <h3>@${other.username}</h3>
        <p>📦 ${d.chat.auction.title} · ${d.chat.auction.sellType === 'DIRECT' ? 'Direct Sale' : 'Winning bid: ' + taka(d.chat.auction.currentMaxBid)}</p>
      </div>
      <div class="messages-wrap" id="messages-wrap">
        ${!d.chat.messages.length ? '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px">No messages yet. Say hello!</div>' :
          d.chat.messages.map(m => {
            const isMe = m.sender.id === S.user?.id;
            return `<div class="msg ${isMe ? 'mine' : 'theirs'}">
              ${m.text}
              <div class="msg-meta">${isMe ? 'You' : '@'+m.sender.username} · ${timeAgo(m.createdAt)}</div>
            </div>`;
          }).join('')}
      </div>
      <div class="msg-input-row">
        <input type="text" id="msg-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendMsg()">
        <button class="btn btn-primary btn-sm" onclick="sendMsg()">Send</button>
      </div>`;

    // Scroll to bottom
    const wrap = document.getElementById('messages-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  } catch (e) { threadEl.innerHTML = `<div class="chat-empty"><p>${e.message}</p></div>`; }
}

async function sendMsg() {
  const input = document.getElementById('msg-input');
  const text  = input?.value.trim();
  if (!text || !S.currentChatId) return;
  input.value = '';
  try {
    await api.chat.send(S.currentChatId, text);
    openChatThread(S.currentChatId); // Refresh thread
  } catch (e) { toast(e.message, 'error'); }
}

async function openChatWithWinner(auctionId) {
  if (!S.user) { openAuth('login'); return; }
  try {
    const d = await api.chat.open(auctionId);
    toast('Chat opened with the winner!');
    nav('chats');
    setTimeout(() => openChatThread(d.chat.id), 600);
  } catch (e) { toast(e.message, 'error'); }
}

// ── NOTIFICATIONS ──────────────────────────────────
async function loadNotifCount() {
  if (!S.user) return;
  try {
    const d = await api.notifs.get();
    const unread = d.notifications.filter(n => !n.read).length;
    const badge  = document.getElementById('notif-badge');
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  } catch {}
}

// ── MOBILE NAV ────────────────────────────────────
function toggleMobileNav() {
  document.getElementById('mobile-nav-panel').classList.toggle('open');
  document.getElementById('mobile-nav-overlay').classList.toggle('open');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) loadNotifsPanel();
}

async function loadNotifsPanel() {
  const el = document.getElementById('notif-list');
  el.innerHTML = '<div class="loading" style="padding:14px;font-size:12px"><span class="spinner"></span></div>';
  try {
    const d = await api.notifs.get();
    if (!d.notifications.length) {
      el.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--muted)">No notifications yet.</div>';
      return;
    }
    el.innerHTML = d.notifications.slice(0, 8).map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n.auctionId}')">
        <div class="notif-type">${n.type.replace(/_/g,' ')}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>`).join('');
  } catch { el.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--red)">Failed to load.</div>'; }
}

async function loadNotifsFull() {
  const el = document.getElementById('notif-full-list');
  el.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  try {
    const d = await api.notifs.get();
    if (!d.notifications.length) {
      el.innerHTML = '<div class="empty-state"><div class="ico">🔔</div><h3>No notifications yet</h3></div>';
      return;
    }
    el.innerHTML = d.notifications.map(n => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:10px;${n.read?'':'border-left:3px solid var(--blue)'}" onclick="handleNotifClick('${n.auctionId}')">
        <div class="notif-type">${n.type.replace(/_/g,' ')}</div>
        <div style="font-size:13px;color:#444;margin:6px 0;line-height:1.5">${n.message}</div>
        <div style="font-size:11px;color:var(--muted)">${fmtDate(n.createdAt)}</div>
      </div>`).join('');
    await api.notifs.readAll();
    document.getElementById('notif-badge').style.display = 'none';
  } catch (e) { el.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
}

function handleNotifClick(auctionId) {
  document.getElementById('notif-panel').classList.remove('open');
  if (auctionId && auctionId !== 'null') openDetail(auctionId);
}

async function markAllRead() {
  try {
    await api.notifs.readAll();
    document.getElementById('notif-badge').style.display = 'none';
    loadNotifsPanel();
    toast('All notifications marked read', 'info');
  } catch {}
}

// ── PAGINATION ─────────────────────────────────────
function renderPagination(containerId, page, pages, onPage) {
  const el = document.getElementById(containerId);
  if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = '';
  if (page > 1) html += `<button class="pg-btn" onclick="(${onPage.toString()})(${page-1})">‹</button>`;
  for (let i = Math.max(1, page-2); i <= Math.min(pages, page+2); i++) {
    html += `<button class="pg-btn${i===page?' active':''}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  }
  if (page < pages) html += `<button class="pg-btn" onclick="(${onPage.toString()})(${page+1})">›</button>`;
  el.innerHTML = html;
}

// ── SOCKET.IO (Real-time) ──────────────────────────
function initSocket() {
  if (typeof io === 'undefined') return;
  const socket = io({ auth: { token: S.token } });

  socket.on('bid_update', (data) => {
    toast(`💰 New bid on auction! Max: ${taka(data.newMax)}`, 'info');
    if (S.currentAuction?.id === data.auctionId) {
      openDetail(data.auctionId);
    }
  });

  socket.on('new_message', (msg) => {
    if (S.currentChatId && document.getElementById('messages-wrap')) {
      openChatThread(S.currentChatId);
    }
    loadNotifCount();
    toast('💬 New message received', 'info');
  });

  document.addEventListener('auction-opened', (e) => {
    socket.emit('join_auction', e.detail);
  });
}

// ── CLOSE NOTIF PANEL ON OUTSIDE CLICK ────────────
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  const btn   = document.getElementById('notif-btn');
  if (panel?.classList.contains('open') && !panel.contains(e.target) && !btn?.contains(e.target)) {
    panel.classList.remove('open');
  }
});

// Enter key on search
document.getElementById('search-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});
document.getElementById('l-pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ── INIT ───────────────────────────────────────────
async function init() {
  // Restore session
  const savedUser  = localStorage.getItem('rd_user');
  const savedToken = localStorage.getItem('rd_token');
  if (savedUser && savedToken) {
    S.user  = JSON.parse(savedUser);
    S.token = savedToken;
    // Verify token still valid
    try {
      const d = await api.auth.me();
      S.user = d.user;
      localStorage.setItem('rd_user', JSON.stringify(d.user));
    } catch {
      S.user  = null;
      S.token = null;
      localStorage.removeItem('rd_user');
      localStorage.removeItem('rd_token');
    }
  }

  updateAuthUI();
  loadHome();
  if (S.user) {
    loadNotifCount();
    loadCartCount();
  }
  initSocket();
  initScrollAnimations();

  // Poll notifications every 30s
  if (S.user) setInterval(() => loadNotifCount(), 30000);
}

// ── SCROLL ANIMATIONS (Intersection Observer) ──────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.animationDelay = `${i * 0.06}s`;
        entry.target.classList.add('card-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  // Observe all auction cards
  function observeCards() {
    document.querySelectorAll('.auction-card:not(.card-visible)').forEach(card => {
      card.classList.add('card-hidden');
      observer.observe(card);
    });
  }

  // Run on load and on DOM changes
  observeCards();
  const gridObserver = new MutationObserver(observeCards);
  const grid = document.getElementById('home-auctions');
  if (grid) gridObserver.observe(grid, { childList: true });
}

init();
