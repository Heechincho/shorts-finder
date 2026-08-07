/* =========================================================
   떡상 쇼츠 파인더 — 인기 급상승 수집기
   GitHub Actions가 1시간마다 이 파일을 실행합니다.
   결과는 data/trending.json 으로 저장됩니다.
   ========================================================= */

const fs = require('fs');

const KEY = process.env.YT_API_KEY;
const REGION = process.env.REGION || 'KR';
const OUT = 'data/trending.json';
const PAGES = 4; // 50개씩 4페이지 = 최대 200개

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

  /* 5. 저장 */
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

  const liveCount = items.filter(x => x.live).length;
  console.log(`✅ 저장 완료 — ${items.length}개 / 실측 증가량 ${liveCount}개 / 간격 ${gapH.toFixed(2)}시간`);
})().catch(err => {
  console.error('❌ 실패:', err.message);
  process.exit(1);
});
