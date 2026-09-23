(() => {
  'use strict';
  const API = 'https://tiktok-content-api.onrender.com';
  const $ = id => document.getElementById(id);
  const form = $('postForm');
  const supported = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
  const labels = {SELF_ONLY: 'Only me', PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers'};
  const receiptKey = 'knowgrow-post-attempt-v2';
  let scopes = [];
  let file, objectUrl, creator, duration = 0, checked = false, busy = false, receipt = null;
  try { receipt = JSON.parse(sessionStorage.getItem(receiptKey) || 'null'); } catch (_) {}
  const status = (title, message, kind = '') => {
    const box = $('statusBox'); box.className = `status-box ${kind}`;
    const heading = document.createElement('strong'); heading.textContent = title;
    box.replaceChildren(heading, document.createTextNode(message));
  };
  const saveReceipt = () => { sessionStorage.setItem(receiptKey, JSON.stringify(receipt)); };
  const json = async (path, payload) => {
    const res = await fetch(API + path, {credentials: 'include', ...(payload ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)} : {})});
    const result = await res.json();
    if (!res.ok || (result.error?.code && result.error.code !== 'ok')) {
      const error = new Error(typeof result.detail === 'string' ? result.detail : result.error?.message || 'Request failed. Reconnect or try again later.');
      error.initRejected = res.status >= 400 && res.status < 500 && !!result.error?.code && !result.data?.publish_id;
      throw error;
    }
    return result;
  };
  const draft = () => $('draftMode').checked;
  const valid = () => Boolean(file && duration > 0 && creator && duration <= creator.max_video_post_duration_sec &&
    (draft() || ($('caption').value.trim() && $('privacyLevel').value &&
      (!$('commercial').checked || $('ownBrand').checked || $('branded').checked) &&
      !($('branded').checked && $('privacyLevel').value === 'SELF_ONLY') &&
      Number.isFinite(Number($('coverTimestamp').value)) && Number($('coverTimestamp').value) >= 0 && Number($('coverTimestamp').value) < duration)));
  const render = () => {
    $('brandOptions').hidden = !$('commercial').checked || draft();
    $('draftNotice').hidden = !draft();
    $('draftMode').parentElement.hidden = !scopes.includes('video.upload');
    const own = $('ownBrand').checked, brand = $('branded').checked;
    $('brandHint').textContent = $('privacyLevel').value === 'SELF_ONLY' ? 'Branded content cannot use Only me visibility.' : (!own && !brand ? 'Select Your brand, Branded content, or both before publishing.' : '');
    $('brandLabel').textContent = brand ? "Your video will be labeled as 'Paid partnership'." : own ? "Your video will be labeled as 'Promotional content'." : '';
    for (const option of $('privacyLevel').options) option.disabled = brand && option.value === 'SELF_ONLY';
    $('branded').disabled = busy || draft() || $('privacyLevel').value === 'SELF_ONLY';
    const declaration = $('policyDeclaration');
    declaration.replaceChildren(document.createTextNode('By posting, you agree to TikTok’s '));
    const link = (text, href) => { const a = document.createElement('a'); a.textContent = text; a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };
    if (brand && !draft()) declaration.append(link('Branded Content Policy', 'https://www.tiktok.com/legal/page/global/bc-policy/en'), document.createTextNode(' and '));
    declaration.append(link('Music Usage Confirmation', 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'), document.createTextNode('.'));
    for (const [id, disabledKey] of [['allowComment', 'comment_disabled'], ['allowDuet', 'duet_disabled'], ['allowStitch', 'stitch_disabled']]) {
      const locked = !creator || creator[disabledKey] !== false;
      $(id).disabled = busy || draft() || locked;
      if (locked) $(id).checked = false;
      $(id).parentElement.title = locked ? 'Unavailable in this TikTok account’s settings.' : '';
    }
    for (const id of ['caption', 'privacyLevel', 'coverTimestamp', 'commercial', 'ownBrand', 'isAigc']) $(id).disabled = busy || draft() || (id === 'privacyLevel' && !creator);
    $('checkVideo').classList.toggle('done', Boolean(file && duration));
    $('checkCaption').classList.toggle('done', Boolean($('caption').value.trim()));
    $('checkValidation').classList.toggle('done', checked);
    $('validateButton').disabled = busy || !!receipt || !valid();
    $('publishButton').disabled = busy || !!receipt || !checked || !valid() || !$('consent').checked;
    $('publishButton').textContent = draft() ? 'Upload to TikTok Inbox' : 'Publish to TikTok';
    $('publishButton').title = $('commercial').checked && !own && !brand ? 'You need to indicate if your content promotes yourself, a third party, or both.' : '';
    $('videoFile').disabled = busy || !!receipt;
    $('replaceVideo').disabled = busy || !!receipt;
    $('draftMode').disabled = busy || !!receipt;
    $('creatorButton').disabled = busy;
    document.querySelectorAll('a[href$="/tiktok/oauth/start"]').forEach(a => { a.hidden = busy; });
    $('consent').disabled = busy;
    $('refreshStatus').hidden = !receipt;
    $('refreshStatus').disabled = busy;
    $('newPost').hidden = !receipt || !['PUBLISH_COMPLETE', 'FAILED', 'REJECTED', 'SEND_TO_USER_INBOX'].includes(receipt.status);
  };
  const invalidate = () => { checked = false; $('consent').checked = false; render(); };
  const loadCreator = async () => {
    const priorAccount = creator?.creator_username || creator?.creator_nickname;
    creator = null; invalidate();
    $('creatorIdentity').textContent = 'Loading connected TikTok account…';
    try {
      const account = await json('/tiktok/account'); scopes = account.scopes || [];
      if (!scopes.includes('video.upload')) $('draftMode').checked = false;
      const result = await json('/tiktok/creator-info'); const data = result.data;
      if (!data?.creator_nickname || !Array.isArray(data.privacy_level_options) || !data.privacy_level_options.length || !(data.max_video_post_duration_sec > 0)) throw new Error('Publishing is currently unavailable for this account. Try again later.');
      const sameAccount = priorAccount === (data.creator_username || data.creator_nickname);
      const previous = sameAccount ? $('privacyLevel').value : '';
      if (!sameAccount) for (const id of ['allowComment', 'allowDuet', 'allowStitch']) $(id).checked = false;
      creator = data;
      $('creatorIdentity').textContent = `${data.creator_nickname}${data.creator_username ? ` (@${data.creator_username})` : ''}`;
      $('creatorLimits').textContent = `Maximum video duration: ${data.max_video_post_duration_sec} seconds. Visibility and interactions come from this account’s current settings.`;
      $('privacyLevel').replaceChildren(new Option('Select visibility', ''));
      for (const value of data.privacy_level_options) $('privacyLevel').add(new Option(labels[value] || value, value));
      // Preserve only an explicit selection made on this page, never choose a default.
      $('privacyLevel').value = data.privacy_level_options.includes(previous) ? previous : '';
      render(); return data;
    } catch (error) {
      $('creatorIdentity').textContent = 'TikTok account is not ready to post.';
      $('creatorLimits').textContent = '';
      $('privacyLevel').replaceChildren(new Option('Select visibility', ''));
      status('Connect or refresh your TikTok account', error.message, 'error'); render(); throw error;
    }
  };
  const loadFile = f => {
    if (busy || receipt || !f) return;
    if (!supported.has(f.type) || f.size <= 0 || f.size > 4 * 1024 ** 3) { status('Unsupported video', 'Choose an MP4, MOV or WebM video up to 4 GB.', 'error'); return; }
    file = f; duration = 0;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file); $('videoPreview').src = objectUrl;
    $('dropZone').hidden = true; $('fileSummary').classList.add('visible');
    $('fileName').textContent = file.name; $('fileSize').textContent = `${(file.size / 1024 ** 2).toFixed(2)} MB`;
    $('fileDuration').textContent = 'Reading…'; invalidate();
  };
  $('videoPreview').addEventListener('loadedmetadata', () => {
    duration = Number.isFinite($('videoPreview').duration) ? $('videoPreview').duration : 0;
    $('fileDuration').textContent = `${duration.toFixed(1)} seconds`;
    $('fileFrame').textContent = `${$('videoPreview').videoWidth} × ${$('videoPreview').videoHeight}`;
    invalidate(); if (creator && duration > creator.max_video_post_duration_sec) status('Video is too long', `Choose a video no longer than ${creator.max_video_post_duration_sec} seconds.`, 'error');
  });
  $('videoPreview').addEventListener('error', () => { duration = 0; invalidate(); status('Video preview unavailable', 'Choose a video that this browser can play before posting.', 'error'); });
  $('videoFile').addEventListener('change', e => loadFile(e.target.files[0]));
  $('replaceVideo').addEventListener('click', () => $('videoFile').click());
  ['dragover', 'drop'].forEach(event => $('dropZone').addEventListener(event, e => { e.preventDefault(); if (event === 'drop') loadFile(e.dataTransfer.files[0]); }));
  form.addEventListener('input', e => {
    $('captionCount').textContent = $('caption').value.length;
    if (e.target.id !== 'consent') { checked = false; $('consent').checked = false; }
    if (!$('commercial').checked || draft()) { $('ownBrand').checked = false; $('branded').checked = false; }
    render();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || receipt || !valid()) return;
    busy = true; render();
    try { await loadCreator(); if (!valid()) throw new Error('Review the updated account settings and video duration.'); checked = true; status('Publication check passed', 'Review the preview and settings, then give consent before uploading.'); }
    catch (error) { status('Publication check failed', error.message, 'error'); }
    finally { busy = false; render(); }
  });
  const showReceipt = () => {
    if (!receipt) return;
    const suffix = `Reference: ${receipt.publishId || receipt.requestId}.`;
    if (receipt.status === 'PUBLISH_COMPLETE') status('TikTok confirmed publication', `${suffix} It may take a few minutes to appear on your profile. Open TikTok to view the actual post.`, 'success');
    else if (receipt.status === 'SEND_TO_USER_INBOX' && receipt.mode === 'draft') status('Delivered to TikTok Inbox', `${suffix} Open the TikTok Inbox notification to finish editing and publish.`, 'success');
    else if (receipt.status === 'REJECTED') status('TikTok rejected initialization', `${receipt.reason || ''} ${suffix} No video was uploaded.`, 'error');
    else if (receipt.status === 'FAILED') status('TikTok reported a failure', `${receipt.reason || ''} ${suffix} No automatic retry was made.`, 'error');
    else status('Posting result pending', `${suffix} ${receipt.status || 'Response not confirmed'}. Refresh the status; do not submit this video again.`);
  };
  const refreshStatus = async () => {
    if (!receipt) return false;
    if (!receipt.publishId) { const attempt = await json('/tiktok/publish/attempt/' + encodeURIComponent(receipt.requestId)); receipt.publishId = attempt.publish_id; saveReceipt(); if (!receipt.publishId) throw new Error('The submission response is still unconfirmed. Contact Support with the reference.'); }
    const result = await json('/tiktok/publish/status/fetch', {publish_id: receipt.publishId});
    receipt.status = result.data?.status || 'UNKNOWN'; receipt.reason = result.data?.fail_reason || '';
    saveReceipt(); showReceipt(); render();
    return ['PUBLISH_COMPLETE', 'FAILED'].includes(receipt.status) || (receipt.mode === 'draft' && receipt.status === 'SEND_TO_USER_INBOX');
  };
  const send = async () => {
    if (busy || receipt || !checked || !valid() || !$('consent').checked) return;
    const selected = file, mode = draft() ? 'draft' : 'publish';
    const chunkSize = selected.size <= 64_000_000 ? selected.size : 10_000_000;
    const count = Math.max(1, Math.floor(selected.size / chunkSize));
    const payload = {expected_creator: creator.creator_username || creator.creator_nickname, request_id: crypto.randomUUID(), consent: true, video_duration_sec: duration,
      source_info: {source: 'FILE_UPLOAD', video_size: selected.size, chunk_size: chunkSize, total_chunk_count: count}};
    if (mode === 'publish') payload.post_info = {title: $('caption').value.trim(), privacy_level: $('privacyLevel').value,
      disable_comment: !$('allowComment').checked, disable_duet: !$('allowDuet').checked, disable_stitch: !$('allowStitch').checked,
      video_cover_timestamp_ms: Math.round(Number($('coverTimestamp').value) * 1000), is_aigc: $('isAigc').checked,
      brand_organic_toggle: $('commercial').checked && $('ownBrand').checked, brand_content_toggle: $('commercial').checked && $('branded').checked};
    receipt = {requestId: payload.request_id, mode, status: 'SUBMITTING', filename: selected.name};
    // Persist before the network request: a lost response must not cause another init.
    try { saveReceipt(); } catch (_) { receipt = null; status('Browser storage unavailable', 'Enable session storage before posting so an interrupted upload can be identified.', 'error'); return; }
    busy = true; render();
    try {
      status('Submitting to TikTok', 'Keep this page open while the video uploads.');
      const result = await json(mode === 'draft' ? '/tiktok/upload/video/init' : '/tiktok/publish/video/init', payload);
      receipt.publishId = result.data?.publish_id; receipt.status = 'PROCESSING_UPLOAD'; saveReceipt();
      const url = new URL(result.data?.upload_url);
      if (!receipt.publishId || url.protocol !== 'https:') throw new Error('TikTok did not return a valid upload destination.');
      for (let index = 0; index < count; index++) {
        const start = index * chunkSize, end = index === count - 1 ? selected.size : start + chunkSize;
        const response = await fetch(url.href, {method: 'PUT', headers: {'Content-Type': selected.type, 'Content-Range': `bytes ${start}-${end - 1}/${selected.size}`}, body: selected.slice(start, end, selected.type)});
        if (!response.ok) throw new Error('Video transfer was interrupted. Check the posting status before retrying.');
      }
      for (let i = 0; i < 8; i++) { if (await refreshStatus()) break; await new Promise(resolve => setTimeout(resolve, 3000)); }
      showReceipt();
    } catch (error) {
      receipt.status = error.initRejected && !receipt.publishId ? 'REJECTED' : 'UNKNOWN'; receipt.reason = error.message; saveReceipt();
      if (receipt.status === 'REJECTED') { showReceipt(); return; }
      status('Posting result needs checking', `${error.message} Reference: ${receipt.publishId || receipt.requestId}. No automatic retry will be made.`, 'error');
    } finally { busy = false; checked = false; $('consent').checked = false; render(); }
  };
  $('publishButton').addEventListener('click', send);
  $('creatorButton').addEventListener('click', () => loadCreator().catch(() => {}));
  $('refreshStatus').addEventListener('click', async () => {
    busy = true; render(); try { await refreshStatus(); } catch (error) { status('Status unavailable', `${error.message} The existing attempt is retained; do not resubmit.`, 'error'); } finally { busy = false; render(); }
  });
  $('newPost').addEventListener('click', () => { if (busy) return; sessionStorage.removeItem(receiptKey); location.reload(); });
  window.addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } });
  history.replaceState({}, '', location.pathname);
  render(); loadCreator().then(() => showReceipt()).catch(() => { if (receipt) showReceipt(); });
})();
