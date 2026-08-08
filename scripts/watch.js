/* =========================================================
   떡상 쇼츠 파인더 — 내 분야 레이더 수집기

   급상승 차트는 전국 1등만 보여줘서 니치 분야가 안 잡힙니다.
   이 스크립트는 반대로 갑니다.

     1) 키워드로 "지켜볼 채널"을 찾아 목록에 쌓고
     2) 그 채널들의 최신 영상을 매번 훑습니다

   검색은 1회 100유닛이지만 채널 훑기는 1유닛이라,
   같은 예산으로 100배 넓게 볼 수 있습니다.

   저장 결과
   - data/watchlist.json : 지켜볼 채널 목록 (자동으로 늘어납니다)
   - data/radar.json     : 그 채널들의 최신 영상 + 채널 요약
   ========================================================= */

const fs = require('fs');

const KEY = process.env.YT_API_KEY;
const REGION = process.env.REGION || 'KR';
const MAX_UNITS = +(process.env.MAX_UNITS || 3000);  // 이번 실행에서 쓸 최대 유닛
const SEED_PER_RUN = +(process.env.SEED_PER_RUN || 2); // 한 번에 탐색할 키워드 수

const WATCH = 'data/watchlist.json';
const OUT = 'data/radar.json';

let used = 0;   // 이번 실행에서 쓴 유닛

/* ---------- 유튜브 API 호출 ---------- */
async function api(endpoint, params, cost) {
  if (used + cost > MAX_UNITS) throw new Error('BUDGET');
  const url = new URL('https://www.googleapis.com/youtube/v3/' + endpoint);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
  }
  url.searchParams.set('key', KEY);

  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  used += cost;
  if (!res.ok) {
    throw new Error(`${endpoint} 실패 (${res.status}): ${json.error?.message || '알 수 없음'}`);
  }
  return json;
}

function parseDur(iso) {
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

const readJSON = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
};

/* ---------- 메인 ---------- */
(async () => {
  if (!KEY) {
    console.error('❌ YT_API_KEY 가 없습니다. GitHub Secrets를 확인하세요.');
    process.exit(1);
  }

  const wl = readJSON(WATCH, null);
  if (!wl || !Array.isArray(wl.keywords)) {
    console.error('❌ data/watchlist.json 이 없거나 형식이 잘못됐습니다.');
    process.exit(1);
  }
  wl.channels = Array.isArray(wl.channels) ? wl.channels : [];
  const maxChannels = wl.maxChannels || 300;
  const perChannel = wl.videosPerChannel || 6;
  const keepDays = wl.keepDays || 60;

  const prev = readJSON(OUT, null);
  const prevMap = {};
  if (prev?.items) prev.items.forEach(v => { prevMap[v.id] = v; });
  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  const gapH = prev?.collectedAt ? (now - new Date(prev.collectedAt)) / 3600000 : 0;
  const canCompare = !!prev && gapH >= 0.2;

  const known = new Set(wl.channels.map(c => c.id));

  /* ── 1단계. 채널 찾기 (목록이 덜 찼을 때만) ───────────────────
     검색은 비싸니까 한 번에 몇 개 키워드만 돌리고,
     매 실행마다 다른 키워드가 걸리도록 순번을 돌립니다.        */
  let found = 0;
  if (wl.channels.length < maxChannels && wl.keywords.length) {
    const turn = wl._turn || 0;
    for (let i = 0; i < SEED_PER_RUN; i++) {
      const kw = wl.keywords[(turn + i) % wl.keywords.length];
      try {
        const r = await api('search', {
          part: 'snippet', q: kw, type: 'video',
          order: 'viewCount', maxResults: 50,
          regionCode: REGION, relevanceLanguage: 'ko',
          publishedAfter: new Date(now - 180 * 86400000).toISOString()
        }, 100);
        (r.items || []).forEach(it => {
          const id = it.snippet?.channelId;
          if (!id || known.has(id) || wl.channels.length >= maxChannels) return;
          known.add(id);
          wl.channels.push({ id, name: it.snippet.channelTitle, from: kw, addedAt: nowISO });
          found++;
        });
        console.log(`🔎 "${kw}" 탐색 완료 (누적 채널 ${wl.channels.length}개)`);
      } catch (e) {
        if (e.message === 'BUDGET') break;
        console.log(`⚠️  "${kw}" 탐색 실패: ${e.message}`);
      }
    }
    wl._turn = (turn + SEED_PER_RUN) % Math.max(1, wl.keywords.length);
  }

  /* ── 2단계. 채널 정보 갱신 (업로드 재생목록 · 구독자) ────────
     channels.list 는 50개당 1유닛이라 아주 쌉니다.            */
  const ids = wl.channels.map(c => c.id);
  const info = {};
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const r = await api('channels', {
        part: 'snippet,statistics,contentDetails',
        id: ids.slice(i, i + 50).join(',')
      }, 1);
      (r.items || []).forEach(c => {
        info[c.id] = {
          name: c.snippet.title,
          thumb: (c.snippet.thumbnails.medium || c.snippet.thumbnails.default).url,
          subs: c.statistics?.hiddenSubscriberCount ? 0 : +(c.statistics?.subscriberCount || 0),
          uploads: c.contentDetails?.relatedPlaylists?.uploads || ''
        };
      });
    } catch (e) {
      if (e.message === 'BUDGET') break;
      throw e;
    }
  }
  // 목록에 최신 정보 반영 (사라진 채널은 정리)
  wl.channels = wl.channels.filter(c => info[c.id]).map(c => ({
    ...c,
    name: info[c.id].name,
    uploads: info[c.id].uploads
  }));
  console.log(`📇 채널 ${wl.channels.length}개 정보 갱신 (유닛 ${used})`);

  /* ── 3단계. 각 채널 최신 영상 훑기 (채널당 1유닛) ──────────── */
  const videoIds = [];
  let swept = 0;
  for (const c of wl.channels) {
    const pl = info[c.id]?.uploads;
    if (!pl) continue;
    try {
      const r = await api('playlistItems', {
        part: 'contentDetails', playlistId: pl, maxResults: perChannel
      }, 1);
      (r.items || []).forEach(it => {
        const vid = it.contentDetails?.videoId;
        if (vid) videoIds.push(vid);
      });
      swept++;
    } catch (e) {
      if (e.message === 'BUDGET') { console.log('⏸  예산에 도달해 여기까지만 훑었습니다.'); break; }
      // 비공개/삭제된 재생목록은 건너뜁니다
    }
  }
  console.log(`📥 채널 ${swept}개에서 영상 ${videoIds.length}개 수집 (유닛 ${used})`);

  /* ── 4단계. 영상 상세 (50개당 1유닛) ───────────────────────── */
  const raw = [];
  const uniq = [...new Set(videoIds)];
  for (let i = 0; i < uniq.length; i += 50) {
    try {
      const r = await api('videos', {
        part: 'snippet,statistics,contentDetails',
        id: uniq.slice(i, i + 50).join(',')
      }, 1);
      raw.push(...(r.items || []));
    } catch (e) {
      if (e.message === 'BUDGET') break;
      throw e;
    }
  }

  /* ── 5단계. 지표 계산 ──────────────────────────────────────── */
  const cutoff = now - keepDays * 86400000;
  const items = raw
    .filter(v => new Date(v.snippet.publishedAt).getTime() >= cutoff)
    .map(v => {
      const views = +(v.statistics?.viewCount || 0);
      const ch = info[v.snippet.channelId] || {};
      const subs = ch.subs || 0;
      const ageH = Math.max(1, (now - new Date(v.snippet.publishedAt)) / 3600000);
      const p = prevMap[v.id];

      let rate = views / ageH;   // 기본: 업로드 후 평균 시간당 조회수
      let live = false;          // 직전 수집과 비교한 실측인지
      if (p && canCompare) {
        const delta = views - p.views;
        if (delta > 0) { rate = delta / gapH; live = true; }
      }

      const th = v.snippet.thumbnails;
      return {
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        thumb: (th.medium || th.high || th.default).url,
        views,
        subs,
        score: subs > 0 ? +(views / subs).toFixed(2) : 0,
        dur: parseDur(v.contentDetails?.duration),
        published: v.snippet.publishedAt,
        rate: Math.round(rate),
        live,
        firstSeen: p?.firstSeen || nowISO
      };
    });

  /* 채널 요약 — 앱이 매번 계산하지 않도록 미리 만들어 둡니다 */
  const chMap = {};
  items.forEach(v => {
    const k = v.channelId;
    if (!chMap[k]) {
      const ci = info[k] || {};
      chMap[k] = {
        channelId: k, name: v.channel, thumb: ci.thumb || v.thumb,
        subs: v.subs, videos: 0, views: 0, shorts: 0, longs: 0, best: 0
      };
    }
    const c = chMap[k];
    c.videos++; c.views += v.views;
    if (v.dur > 0 && v.dur <= 180) c.shorts++; else if (v.dur > 180) c.longs++;
    if (v.score > c.best) c.best = v.score;
  });
  const channels = Object.values(chMap)
    .map(c => ({ ...c, avg: Math.round(c.views / c.videos) }))
    .sort((a, b) => b.avg - a.avg);

  /* ── 6단계. 저장 ──────────────────────────────────────────── */
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    collectedAt: nowISO,
    prevCollectedAt: prev?.collectedAt || null,
    gapHours: +gapH.toFixed(2),
    compared: canCompare,
    keepDays,
    channelCount: channels.length,
    videoCount: items.length,
    unitsUsed: used,
    channels,
    items
  }));
  fs.writeFileSync(WATCH, JSON.stringify(wl, null, 2));

  const liveN = items.filter(v => v.live).length;
  console.log(`✅ 저장 완료 — 영상 ${items.length}개 / 채널 ${channels.length}개`);
  console.log(`   신규 채널 ${found}개 / 실측 증가량 ${liveN}개 / 이번 실행 ${used}유닛`);
})().catch(err => {
  if (err.message === 'BUDGET') {
    console.log('⏸  예산 한도에 도달해 중단했습니다. 다음 실행에서 이어집니다.');
    process.exit(0);
  }
  console.error('❌ 실패:', err.message);
  process.exit(1);
});
