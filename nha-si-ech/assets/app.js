(function(){
  const cfg = window.NHA_SI_ECH_CONFIG || {};
  const connect = document.querySelector('[data-connect-tiktok]');
  const status = document.querySelector('[data-status]');
  const accountName = document.querySelector('[data-account-name]');
  const accountMeta = document.querySelector('[data-account-meta]');
  const accountInput = document.querySelector('[data-account-input]');
  const avatar = document.querySelector('[data-account-avatar]');
  const dot = document.querySelector('[data-account-dot]');
  const privacy = document.querySelector('[data-privacy]');

  const params = new URLSearchParams(window.location.search);
  const querySession = params.get('session');
  let session = '';

  if (querySession) {
    localStorage.setItem('nse_tiktok_session', querySession);
    session = querySession;
    const clean = new URL(window.location.href);
    clean.searchParams.delete('session');
    clean.searchParams.delete('connected');
    history.replaceState({}, '', clean.pathname);
  } else {
    session = localStorage.getItem('nse_tiktok_session') || '';
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.style.background = kind === 'error' ? '#fff0ee' : kind === 'ok' ? '#eaf7f6' : '#fff7df';
    status.style.color = kind === 'error' ? '#9a2d21' : '#0d7771';
  }

  if (connect) connect.href = cfg.tiktokOAuthStartUrl || '#';

  async function loadAccount() {
    if (!session || !cfg.tiktokStatusUrl) {
      setStatus('TikTok is not connected. Connect the production account once to enable automatic publishing.', 'warn');
      if (accountInput) accountInput.value = 'Not connected';
      return;
    }

    try {
      const res = await fetch(cfg.tiktokStatusUrl + '?session=' + encodeURIComponent(session), {method:'GET', cache:'no-store'});
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Could not load TikTok creator.');

      const creator = data.creator || {};
      const profile = data.profile || {};
      const display = creator.nickname || profile.display_name || creator.username || 'TikTok creator';

      if (accountName) accountName.textContent = display;
      if (accountMeta) accountMeta.textContent = creator.username ? '@' + creator.username : 'Authorized TikTok account';
      if (accountInput) accountInput.value = display;
      if (dot) dot.classList.add('ok');

      const avatarUrl = creator.avatar_url || profile.avatar_url || '';
      if (avatar && avatarUrl) { avatar.src = avatarUrl; avatar.hidden = false; }

      const options = Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [];
      if (privacy) {
        privacy.innerHTML = '';
        options.forEach(function(value) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          if (value === 'PUBLIC_TO_EVERYONE') option.selected = true;
          privacy.appendChild(option);
        });
        if (!options.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No privacy option returned';
          privacy.appendChild(option);
        }
      }

      if (options.includes('PUBLIC_TO_EVERYONE')) {
        setStatus('TikTok Production connected. PUBLIC_TO_EVERYONE is available. Auto Publisher is ready.', 'ok');
      } else {
        setStatus('TikTok connected, but PUBLIC_TO_EVERYONE is not currently available for this account.', 'warn');
      }
    } catch (err) {
      localStorage.removeItem('nse_tiktok_session');
      session = '';
      if (accountInput) accountInput.value = 'Connection error';
      setStatus('TikTok connection failed: ' + err.message, 'error');
    }
  }

  loadAccount();
})();
