/* =========================================================
   떡상 쇼츠 파인더 — 인기 급상승 수집기
   GitHub Actions가 1시간마다 이 파일을 실행합니다.

   저장 결과
   - data/trending.json : 지금 이 순간의 급상승 200개 (매번 덮어씀)
   - data/history.json  : 최근 7일간 급상승에 올랐던 영상 누적 (채널 랭킹용)
   ========================================================= */

const fs = require('fs');

const KEY = process.env.YT_API_KEY;
const REGION = process.env.REGION || 'KR';
const OUT = 'data/trending.json';
const HIST = 'data/history.json';
const PAGES = 4;        // 50개씩 4페이지 = 최대 200개
const KEEP_DAYS = 7;    // 누적 보관 기간

/* ---------- 유튜브 API 호출 ---------- */
async function api(endpoint, params) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + endpoint);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
  }
  url.searchParams.set('key', KEY);

  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${endpoint} 요청 실패 (${res.status}): ${json.error?.message || '알 수 없음'}`);
  }
  return json;
}

/* ---------- ISO 8601 재생시간 → 초 ---------- */
function parseDur(iso) {
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

/* ---------- 메인 ---------- */
(async () => {
  if (!KEY) {
    console.error('❌ YT_API_KEY 가 없습니다. GitHub Secrets에 등록했는지 확인하세요.');
    process.exit(1);
  }

  /* 1. 지난번 수집 결과 읽기 (비교용) */
  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch (e) {
    console.log('ℹ️  이전 기록이 없습니다. 이번이 첫 수집입니다.');
  }

  const prevMap = {};
  if (prev?.items) prev.items.forEach(v => { prevMap[v.id] = v; });

  const now = Date.now();
  const gapH = prev?.collectedAt ? (now - new Date(prev.collectedAt)) / 3600000 : 0;
  const canCompare = !!prev && gapH >= 0.2; // 12분 이상 지났을 때만 비교

  /* 2. 인기 급상승 차트 수집 */
  const raw = [];
  let token = null;
  for (let p = 0; p < PAGES; p++) {
    const r = await api('videos', {
      part: 'snippet,statistics,contentDetails',
      chart: 'mostPopular',
      regionCode: REGION,
      maxResults: 50,
      pageToken: token
    });
    raw.push(...(r.items || []));
    token = r.nextPageToken;
    if (!token) break;
  }
  console.log(`📥 영상 ${raw.length}개 수집`);

  /* 3. 채널 구독자 수 (50개씩 묶어서) */
  const chIds = [...new Set(raw.map(v => v.snippet.channelId))];
  const subs = {};
  for (let i = 0; i < chIds.length; i += 50) {
    const r = await api('channels', {
      part: 'statistics',
      id: chIds.slice(i, i + 50).join(',')
    });
    (r.items || []).forEach(c => { subs[c.id] = +(c.statistics?.subscriberCount || 0); });
  }
  console.log(`📥 채널 ${Object.keys(subs).length}개 구독자 수 수집`);

  /* 4. 계산 */
  const nowISO = new Date(now).toISOString();

  const items = raw.map((v, i) => {
    const views = +(v.statistics?.viewCount || 0);
    const rank = i + 1;
    const p = prevMap[v.id];
    const ageH = Math.max(1, (now - new Date(v.snippet.publishedAt)) / 3600000);

    // 기본값: 업로드 후 평균 시간당 조회수
    let rate = views / ageH;
    let live = false;              // 실측 여부
    let status = 'new';
    let prevRank = null;
    let prevViews = null;

    if (p && canCompare) {
      const delta = views - p.views;
      if (delta > 0) { rate = delta / gapH; live = true; }
      prevRank = p.rank;
      prevViews = p.views;
      status = rank < p.rank ? 'up' : rank > p.rank ? 'down' : 'hold';
    } else if (p) {
      prevRank = p.rank;
      status = 'hold';
    }

    const sb = subs[v.snippet.channelId] || 0;
    const th = v.snippet.thumbnails;

    return {
      id: v.id,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      channelId: v.snippet.channelId,
      thumb: (th.standard || th.high || th.medium || th.default).url,
      views,
      subs: sb,
      score: sb > 0 ? +(views / sb).toFixed(2) : 0,
      dur: parseDur(v.contentDetails?.duration),
      published: v.snippet.publishedAt,
      category: v.snippet.categoryId,
      rank,
      prevRank,
      prevViews,
      rate: Math.round(rate),
      live,
      status,
      firstSeen: p?.firstSeen || nowISO
    };
  });

  /* 5. 지금 이 순간 저장 */
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    collectedAt: nowISO,
    prevCollectedAt: prev?.collectedAt || null,
    gapHours: +gapH.toFixed(2),
    compared: canCompare,
    region: REGION,
    count: items.length,
    items
  }));

  /* ---------------------------------------------------------
     6. 누적 기록 — 채널 랭킹을 제대로 만들기 위한 부분

     급상승 차트는 한 채널에서 한 편만 올려주기 때문에,
     한 시점만 보면 "채널당 영상 1개"가 되어 순위가 의미 없습니다.
     여러 날 치를 모으면 "이번 주에 3편 올려서 총 800만" 같은
     진짜 채널 순위를 만들 수 있습니다.
     --------------------------------------------------------- */
  let hist = { items: [] };
  try {
    hist = JSON.parse(fs.readFileSync(HIST, 'utf8'));
    if (!Array.isArray(hist.items)) hist.items = [];
  } catch (e) {
    console.log('ℹ️  누적 기록이 없습니다. 새로 시작합니다.');
  }

  const histMap = {};
  hist.items.forEach(v => { histMap[v.id] = v; });

  let added = 0;
  items.forEach(v => {
    const h = histMap[v.id];
    if (h) {
      // 이미 본 영상이면 최신 수치로 갱신 (조회수는 계속 올라가므로)
      h.views = Math.max(h.views, v.views);
      h.subs = v.subs || h.subs;
      h.lastSeen = nowISO;
      h.seenCount = (h.seenCount || 1) + 1;
      h.bestRank = Math.min(h.bestRank || v.rank, v.rank);
      if (v.rate > (h.peakRate || 0)) h.peakRate = v.rate;
    } else {
      histMap[v.id] = {
        id: v.id,
        title: v.title,
        channel: v.channel,
        channelId: v.channelId,
        thumb: v.thumb,
        dur: v.dur,
        category: v.category,
        published: v.published,
        views: v.views,
        subs: v.subs,
        firstSeen: v.firstSeen,
        lastSeen: nowISO,
        seenCount: 1,
        bestRank: v.rank,
        peakRate: v.rate
      };
      added++;
    }
  });

  // 오래된 기록 정리
  const cutoff = now - KEEP_DAYS * 24 * 3600 * 1000;
  const kept = Object.values(histMap).filter(v => new Date(v.lastSeen).getTime() >= cutoff);

  // 채널별 요약도 같이 저장 (앱이 계산할 필요 없게)
  const chMap = {};
  kept.forEach(v => {
    const k = v.channelId || v.channel;
    if (!chMap[k]) {
      chMap[k] = {
        channelId: v.channelId, name: v.channel, thumb: v.thumb,
        subs: v.subs, videos: 0, views: 0, shorts: 0, longs: 0, bestRank: 999
      };
    }
    const c = chMap[k];
    c.videos++;
    c.views += v.views;
    if (v.subs > c.subs) c.subs = v.subs;
    if (v.dur > 0 && v.dur <= 180) c.shorts++; else if (v.dur > 180) c.longs++;
    if (v.bestRank < c.bestRank) c.bestRank = v.bestRank;
  });
  const channels = Object.values(chMap)
    .map(c => ({ ...c, avg: Math.round(c.views / c.videos) }))
    .sort((a, b) => b.views - a.views);

  fs.writeFileSync(HIST, JSON.stringify({
    updatedAt: nowISO,
    keepDays: KEEP_DAYS,
    videoCount: kept.length,
    channelCount: channels.length,
    channels,
    items: kept
  }));

  const liveCount = items.filter(x => x.live).length;
  const multi = channels.filter(c => c.videos > 1).length;
  console.log(`✅ 저장 완료 — ${items.length}개 / 실측 증가량 ${liveCount}개 / 간격 ${gapH.toFixed(2)}시간`);
  console.log(`📚 누적 — 영상 ${kept.length}개 (신규 ${added}) / 채널 ${channels.length}개 / 2편 이상 올린 채널 ${multi}개`);
})().catch(err => {
  console.error('❌ 실패:', err.message);
  process.exit(1);
});
