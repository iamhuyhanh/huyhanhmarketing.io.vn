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
  const caption = document.querySelector('[data-caption]');
  const consent = document.querySelector('[data-consent]');
  const publish = document.querySelector('[data-publish]');
  const result = document.querySelector('[data-result]');
  const allowComment = document.querySelector('[data-allow-comment]');
  const allowDuet = document.querySelector('[data-allow-duet]');
  const allowStitch = document.querySelector('[data-allow-stitch]');

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

  if (connect) {
    connect.href = (cfg.tiktokOAuthStartUrl || '#') + '?return_to=audit';
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.style.background = kind === 'error' ? '#fff0ee' : kind === 'ok' ? '#eaf7f6' : '#fff7df';
    status.style.color = kind === 'error' ? '#9a2d21' : '#0d7771';
  }

  function syncButton() {
    if (!publish) return;
    publish.disabled = !(session && consent && consent.checked && privacy && privacy.value && caption && caption.value.trim());
  }

  async function loadAccount() {
    if (!session || !cfg.tiktokStatusUrl) {
      setStatus('Connect TikTok to review the creator settings.', 'warn');
      syncButton();
      return;
    }

    try {
      const res = await fetch(cfg.tiktokStatusUrl + '?session=' + encodeURIComponent(session), {method:'GET', cache:'no-store'});
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Could not load TikTok creator.');

      const creator = data.creator || {};
      const profile = data.profile || {};
      const display = creator.nickname || profile.display_name || creator.username || 'TikTok creator';

      accountName.textContent = display;
      accountMeta.textContent = creator.username ? '@' + creator.username : 'Authorized TikTok account';
      accountInput.value = display;
      dot.classList.add('ok');

      const avatarUrl = creator.avatar_url || profile.avatar_url || '';
      if (avatar && avatarUrl) { avatar.src = avatarUrl; avatar.hidden = false; }

      const options = Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [];
      privacy.innerHTML = '';
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
      privacy.disabled = false;

      if (creator.comment_disabled) { allowComment.checked = false; allowComment.disabled = true; }
      if (creator.duet_disabled) { allowDuet.checked = false; allowDuet.disabled = true; }
      if (creator.stitch_disabled) { allowStitch.checked = false; allowStitch.disabled = true; }

      setStatus('TikTok connected. Review the post settings and explicitly confirm before posting.', 'ok');
    } catch (err) {
      localStorage.removeItem('nse_tiktok_session');
      session = '';
      setStatus('TikTok connection failed: ' + err.message, 'error');
    }
    syncButton();
  }

  async function pollStatus(publishId) {
    for (let i = 0; i < 25; i++) {
      await new Promise(resolve => setTimeout(resolve, 4000));
      const url = cfg.tiktokAuditStatusUrl + '?session=' + encodeURIComponent(session) + '&publish_id=' + encodeURIComponent(publishId);
      const res = await fetch(url, {method:'GET', cache:'no-store'});
      const data = await res.json();

      if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Could not check publish status.');

      const s = String(data.status || 'PROCESSING');
      result.textContent = 'Publish ID: ' + publishId + ' • ' + s;

      if (s === 'PUBLISH_COMPLETE') {
        setStatus('TikTok publish completed successfully.', 'ok');
        return;
      }
      if (s === 'FAILED') {
        throw new Error(data.fail_reason || 'TikTok publish failed.');
      }
    }
    setStatus('TikTok accepted the post and is still processing it.', 'warn');
  }

  if (consent) consent.addEventListener('change', syncButton);
  if (privacy) privacy.addEventListener('change', syncButton);
  if (caption) caption.addEventListener('input', syncButton);

  if (publish) {
    publish.addEventListener('click', async function(){
      if (publish.disabled) return;
      publish.disabled = true;
      result.textContent = '';
      setStatus('Submitting the confirmed post to TikTok...', 'warn');

      try {
        const form = new URLSearchParams();
        form.set('session', session);
        form.set('caption', caption.value.trim());
        form.set('privacy', privacy.value);
        form.set('allow_comment', String(!!allowComment.checked));
        form.set('allow_duet', String(!!allowDuet.checked));
        form.set('allow_stitch', String(!!allowStitch.checked));
        form.set('consent', 'true');

        const res = await fetch(cfg.tiktokAuditPublishUrl, {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body:form.toString()
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || data.error_detail || data.error || 'Publish request failed.');

        result.textContent = 'Publish ID: ' + data.publish_id + ' • PROCESSING';
        setStatus('TikTok accepted the post. Waiting for processing...', 'warn');
        await pollStatus(data.publish_id);
      } catch (err) {
        setStatus('Publish failed: ' + err.message, 'error');
      } finally {
        syncButton();
      }
    });
  }

  loadAccount();
})();