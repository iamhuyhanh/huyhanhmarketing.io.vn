(function(){
  const cfg = window.NHA_SI_ECH_CONFIG || {};
  const connect = document.querySelector('[data-connect-tiktok]');
  const publish = document.querySelector('[data-publish]');
  const consent = document.querySelector('[data-consent]');
  const status = document.querySelector('[data-status]');
  const accountName = document.querySelector('[data-account-name]');
  const accountMeta = document.querySelector('[data-account-meta]');
  const accountInput = document.querySelector('[data-account-input]');
  const avatar = document.querySelector('[data-account-avatar]');
  const dot = document.querySelector('[data-account-dot]');
  const privacy = document.querySelector('[data-privacy]');
  const caption = document.querySelector('[data-caption]');
  const publishIdEl = document.querySelector('[data-publish-id]');

  let connected = false;
  let session = "";

  const params = new URLSearchParams(window.location.search);
  const querySession = params.get('session');
  if (querySession) {
    localStorage.setItem('nse_tiktok_session', querySession);
    session = querySession;
    history.replaceState({}, '', '/nha-si-ech/app/');
  } else {
    session = localStorage.getItem('nse_tiktok_session') || "";
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.style.background = kind === 'error' ? '#fff0ee' : kind === 'ok' ? '#eaf7f6' : '#fff7df';
    status.style.color = kind === 'error' ? '#9a2d21' : '#0d7771';
  }

  function syncPublishButton() {
    if (!publish || !consent) return;
    publish.disabled = !(connected && consent.checked && privacy && privacy.value);
  }

  if (connect) {
    connect.href = cfg.tiktokOAuthStartUrl || '#';
  }

  async function loadAccount() {
    if (!session || !cfg.tiktokStatusUrl) {
      setStatus('Connect TikTok before publishing.', 'warn');
      return;
    }

    setStatus('Loading TikTok creator information...', 'warn');

    try {
      const res = await fetch(cfg.tiktokStatusUrl + '?session=' + encodeURIComponent(session), {
        method: 'GET',
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Could not load TikTok creator.');

      connected = true;
      const creator = data.creator || {};
      const profile = data.profile || {};
      const display = creator.nickname || profile.display_name || creator.username || 'TikTok creator';

      if (accountName) accountName.textContent = display;
      if (accountMeta) accountMeta.textContent = creator.username ? '@' + creator.username : 'Authorized TikTok account';
      if (accountInput) accountInput.value = display;
      if (dot) dot.classList.add('ok');

      const avatarUrl = creator.avatar_url || profile.avatar_url || '';
      if (avatar && avatarUrl) {
        avatar.src = avatarUrl;
        avatar.hidden = false;
      }

      if (privacy) {
        privacy.innerHTML = '';
        const options = Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [];
        options.forEach(function(value) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          if (value === 'SELF_ONLY') option.selected = true;
          privacy.appendChild(option);
        });
        if (!options.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No privacy option returned';
          privacy.appendChild(option);
        }
      }

      setStatus('TikTok connected. Review the video, caption and privacy before publishing.', 'ok');
      syncPublishButton();
    } catch (err) {
      connected = false;
      localStorage.removeItem('nse_tiktok_session');
      session = '';
      setStatus('TikTok connection failed: ' + err.message, 'error');
      syncPublishButton();
    }
  }

  async function pollPublish(publishId) {
    if (!cfg.tiktokPublishStatusUrl) return;

    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 4000));

      const res = await fetch(
        cfg.tiktokPublishStatusUrl +
        '?session=' + encodeURIComponent(session) +
        '&publish_id=' + encodeURIComponent(publishId),
        {method:'GET', cache:'no-store'}
      );
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus('Could not check publish status.', 'error');
        return;
      }

      const s = String(data.status || 'PROCESSING');
      if (publishIdEl) publishIdEl.textContent = 'Publish ID: ' + publishId + ' • ' + s;

      if (s === 'PUBLISH_COMPLETE') {
        setStatus('TikTok publish completed successfully.', 'ok');
        return;
      }

      if (s === 'FAILED') {
        setStatus('TikTok publish failed: ' + (data.fail_reason || 'Unknown reason'), 'error');
        return;
      }

      setStatus('TikTok is processing the video: ' + s, 'warn');
    }

    setStatus('Video was uploaded. TikTok is still processing it; check again shortly.', 'warn');
  }

  if (consent) {
    consent.addEventListener('change', syncPublishButton);
  }
  if (privacy) {
    privacy.addEventListener('change', syncPublishButton);
  }

  if (publish) {
    publish.addEventListener('click', async function(){
      if (!connected || !consent.checked || !session) return;

      publish.disabled = true;
      setStatus('Sending the confirmed video to TikTok...', 'warn');
      if (publishIdEl) publishIdEl.textContent = '';

      try {
        const form = new URLSearchParams();
        form.set('session', session);
        form.set('caption', caption ? caption.value : '');
        form.set('privacy', privacy ? privacy.value : 'SELF_ONLY');
        form.set('consent', 'true');

        const res = await fetch(cfg.tiktokPublishUrl, {
          method: 'POST',
          headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body: form.toString()
        });

        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Publish request failed.');

        if (publishIdEl) publishIdEl.textContent = 'Publish ID: ' + data.publish_id;
        setStatus('Video uploaded to TikTok. Waiting for processing...', 'warn');
        await pollPublish(data.publish_id);
      } catch (err) {
        setStatus('Publish failed: ' + err.message, 'error');
      } finally {
        syncPublishButton();
      }
    });
  }

  loadAccount();
})();