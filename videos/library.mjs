import {countText, dateText, safeURL, mergeVideos, sameConnection} from './video-model.mjs';
const $ = id => document.getElementById(id);
const apiBase = document.querySelector('meta[name="api-base"]').content.replace(/\/$/, '');
let connection = null, videos = [], cursor = null, more = false, busy = false, epoch = 0, enabled = false;
$('connect').href = apiBase + '/tiktok/videos/oauth/start';
function status(message, error=false) { $('status').textContent = message; $('status').hidden = !message; $('status').classList.toggle('error',error); }
function controls() {
  $('refresh').disabled = busy || !enabled;
  $('more').disabled = busy; $('more').hidden = !more;
  $('disconnect').disabled = busy;
  $('videos').setAttribute('aria-busy',String(busy));
  $('connect').hidden = !enabled || busy;
}
async function request(path, method='GET') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),25000);
  try {
    const response = await fetch(apiBase + path, {method, credentials:'include', cache:'no-store', signal:controller.signal});
    let body;
    try { body = await response.json(); } catch { throw new Error('The video service is temporarily unavailable. Please try again.'); }
    if (!response.ok) {
      const error = new Error(body.message || (response.status === 422 ? 'This request could not be processed. Please refresh.' : 'The video service is temporarily unavailable. Please try again.'));
      error.status = response.status; throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('The video service is taking too long to respond. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
function clearView() {
  connection = null; videos = []; cursor = null; more = false;
  $('videos').replaceChildren(); $('videoCount').textContent=''; $('updated').textContent='';
  $('avatar').hidden=true; $('avatar').removeAttribute('src');
  $('accountName').textContent='Connect your TikTok account';
  $('accountHint').textContent="You choose whether to share your profile and public videos through TikTok's authorization page.";
  $('disconnect').hidden=true; $('connect').textContent='Connect TikTok';
}
function assertConnection(value) {
  if (!sameConnection(connection,value)) {
    clearView(); throw new Error('The connected account changed. Select Refresh videos to load the current account.');
  }
}
function errorMessage(error) {
  if (error.status === 401 || error.status === 403) clearView();
  status(error.message,true);
}
function element(tag, text, className) {
  const node=document.createElement(tag); if(text !== undefined) node.textContent=text; if(className) node.className=className; return node;
}
function render() {
  const cards = videos.map(video => {
    const card=element('article',undefined,'published-video'); card.dataset.videoId=video.id;
    const cover=safeURL(video.cover_image_url);
    const placeholder=() => element('div','Cover unavailable','video-cover cover-placeholder');
    if(cover) {
      const image=element('img',undefined,'video-cover'); image.src=cover; image.alt=''; image.loading='lazy';
      image.referrerPolicy='no-referrer'; image.addEventListener('error',()=>image.replaceWith(placeholder()),{once:true}); card.append(image);
    } else card.append(placeholder());
    const info=element('div',undefined,'video-info');
    info.append(element('h3',video.title || video.video_description || 'Untitled video'),element('time',dateText(video.create_time)));
    const metrics=element('dl',undefined,'metrics');
    for(const [key,label] of [['view_count','Views'],['like_count','Likes'],['comment_count','Comments'],['share_count','Shares']]) {
      const group=element('div'); group.append(element('dt',label),element('dd',countText(video[key]))); metrics.append(group);
    }
    info.append(metrics);
    const actions=element('div',undefined,'video-actions'), share=safeURL(video.share_url,true);
    if(share) { const link=element('a','View on TikTok ↗'); link.href=share; link.target='_blank'; link.rel='noopener noreferrer'; actions.append(link); }
    const update=element('button','Refresh counts'); update.type='button'; update.disabled=busy;
    update.addEventListener('click',()=>refreshOne(video.id)); actions.append(update); info.append(actions); card.append(info); return card;
  });
  $('videos').replaceChildren(...cards);
  $('videoCount').textContent=videos.length ? '('+videos.length+' loaded)' : '';
}
function loaded(data, append) {
  assertConnection(data.connection);
  if(!Array.isArray(data.videos) || typeof data.has_more !== 'boolean') throw new Error('TikTok returned incomplete video data. Please refresh.');
  if(data.has_more && (!Number.isSafeInteger(data.cursor) || data.cursor < 0 || data.cursor === cursor)) throw new Error('TikTok pagination is temporarily unavailable. Please refresh.');
  videos=mergeVideos(append ? videos : [],data.videos); cursor=data.cursor; more=data.has_more;
  $('updated').textContent=Number.isSafeInteger(data.fetched_at) ? 'Fetched '+new Date(data.fetched_at*1000).toLocaleString() : '';
  render();
  status(!videos.length ? 'No public videos were returned for this account. Private posts are not included.' : '');
}
async function refreshAll() {
  if(busy || !enabled) return;
  const run=++epoch; busy=true; clearView(); status('Loading your TikTok videos…'); controls();
  try {
    const account=await request('/tiktok/videos/account'); if(run !== epoch) return;
    if(typeof account.connection !== 'string' || !account.account || typeof account.account.display_name !== 'string') throw new Error('TikTok profile information is temporarily unavailable.');
    connection=account.connection; $('accountName').textContent=account.account.display_name;
    $('accountHint').textContent='Your public TikTok videos · read-only access';
    const avatar=safeURL(account.account.avatar_url);
    if(avatar) { $('avatar').src=avatar; $('avatar').hidden=false; }
    $('disconnect').hidden=false; $('connect').textContent='Switch TikTok account';
    const data=await request('/tiktok/videos'); if(run !== epoch) return; loaded(data,false);
  } catch(error) { if(run === epoch) errorMessage(error); }
  finally { if(run === epoch) { busy=false; controls(); render(); } }
}
async function nextPage() {
  if(busy || !connection || !more) return;
  const run=epoch; busy=true; controls(); status('Loading more videos…');
  try { const data=await request('/tiktok/videos?cursor='+encodeURIComponent(cursor)); if(run === epoch) loaded(data,true); }
  catch(error) { if(run === epoch) errorMessage(error); }
  finally { if(run === epoch) { busy=false; controls(); render(); } }
}
async function refreshOne(id) {
  if(busy || !connection) return;
  const run=epoch; busy=true; controls(); render(); status('Refreshing this video…');
  try {
    const data=await request('/tiktok/videos/'+encodeURIComponent(id)); if(run !== epoch) return;
    assertConnection(data.connection);
    if(data.video?.id !== id) throw new Error('TikTok returned incomplete video data. Please refresh.');
    videos=mergeVideos(videos,[data.video]); render(); status('');
    $('updated').textContent='Video refreshed '+new Date().toLocaleString();
  } catch(error) {
    if(run === epoch) { if(error.status===404) { videos=videos.filter(video=>video.id!==id); render(); } errorMessage(error); }
  } finally { if(run === epoch) { busy=false; controls(); render(); } }
}
$('refresh').addEventListener('click',refreshAll);
$('more').addEventListener('click',nextPage);
$('disconnect').addEventListener('click',async()=>{
  if(busy) return; const run=++epoch; busy=true; controls();
  try {
    await request('/tiktok/videos/disconnect','POST');
    if(run === epoch) { clearView(); status('Signed out of the video library. You can connect again when you are ready.'); }
  } catch(error) { if(run === epoch) status(error.message,true); }
  finally { if(run === epoch) { busy=false; controls(); } }
});
$('avatar').addEventListener('error',()=>{ $('avatar').hidden=true; });
async function start() {
  try {
    const config=await request('/tiktok/videos/config'); enabled=config.enabled===true; controls();
    if(!enabled) { status('The video library is currently unavailable. Please try again later.'); return; }
    if(new URLSearchParams(location.search).get('connection')==='declined') {
      status('TikTok connection was cancelled. Connect when you are ready to share your public videos.'); return;
    }
    await refreshAll();
  } catch(error) { enabled=false; errorMessage(error); }
  finally { busy=false; controls(); }
}
start();
