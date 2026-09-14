/* Practical topic discovery. Keyword matches do not imply viewer age or reliability. */
const SR={group:'0',topic:'all',type:'all',sort:'views',query:'',items:null,info:'',error:false,request:0};
function srGroup(){return SENIOR_TOPICS.find(g=>g.id===SR.group)||SENIOR_TOPICS[0];}
function srTopics(){return SR.topic==='all'?srGroup().topics:srGroup().topics.filter(t=>t.id===SR.topic);}
function srText(s){return String(s||'').toLocaleLowerCase().replace(/\s+/g,' ').trim();}
function srMatches(v){const title=srText(v.title);return srTopics().some(t=>t.terms.some(w=>w==='관리비'?/관리비(?!결|법)/.test(title):title.includes(srText(w))));}
function pgSenior(){
 $('page').innerHTML=`<section class="sr" aria-label="중장년 콘텐츠 탐색">
 <div class="sr-intro"><div><span class="sr-eyebrow">중장년 콘텐츠 RADAR</span><h2>관심사를 고르면,<br>다음 콘텐츠가 보입니다.</h2><p>실용적인 생활 주제와 실제 수집 영상을 함께 탐색하세요.</p></div><div class="sr-summary"><b>7<span>개 분야</span></b><b>${SENIOR_TOPICS.reduce((n,g)=>n+g.topics.length,0)}<span>개 세부 주제</span></b></div></div>
 <div class="sr-categories" aria-label="관심 분야">${SENIOR_TOPICS.map(g=>`<button data-sr-group="${g.id}" aria-pressed="${g.id===SR.group}"><span>${g.icon}</span>${g.name}</button>`).join('')}</div>
 <div class="sr-work"><section class="sr-panel"><div class="sr-section-title"><div><span class="sr-eyebrow">01 · 주제 선택</span><h3>${srGroup().name}</h3></div><p>${srGroup().desc}</p></div>
 <div class="sr-topics"><button data-sr-topic="all" aria-pressed="${SR.topic==='all'}">전체</button>${srGroup().topics.map(t=>`<button data-sr-topic="${t.id}" aria-pressed="${t.id===SR.topic}">${t.name}</button>`).join('')}</div>
 <div class="sr-filter"><label>영상 길이<select id="sr-type"><option value="all">전체</option><option value="short">쇼츠 · 3분 이하</option><option value="long">롱폼 · 3분 초과</option></select></label><label>정렬<select id="sr-sort"><option value="views">조회수순</option><option value="date">최신순</option><option value="score">구독자 대비 조회수순</option></select></label><label class="sr-filter-query">결과 안에서 찾기<input id="sr-query" placeholder="영상 제목 검색" type="search"></label></div>
 </section><aside class="sr-guide"><span class="sr-eyebrow">콘텐츠 선정 기준</span><h3>인기와 신뢰는 따로 확인</h3><p>비용·절차·비교·실천 방법이 구체적인 콘텐츠를 살펴보세요.</p><p>건강·세금·투자는 원출처와 적용 시점을 확인하고, 수익 보장·완치 등 단정적인 주장은 검증하세요.</p></aside></div>
 <section class="sr-plans"><div class="sr-section-title"><div><span class="sr-eyebrow">02 · 제작 아이디어</span><h3>이런 주제로 만들어보세요</h3></div><span class="sr-muted">편집 기획안 · 인기 순위 아님</span></div><div class="sr-ideas">${srTopics().slice(0,3).map(t=>`<article class="sr-idea"><span class="sr-pill">${t.name}</span><h4>${t.idea}</h4><p>상황 소개 → 확인할 항목 3가지 → 출처와 확인 날짜</p><div><button class="btn" data-sr-search="${t.id}">영상 검색 준비 →</button><button class="sr-text-button" data-sr-plan="${t.id}">기획안 보기</button></div></article>`).join('')}</div><div id="sr-plan" hidden></div></section>
 <section><div class="sr-section-title"><div><span class="sr-eyebrow">03 · 실제 수집 영상</span><h3>주제와 맞는 영상 <span id="sr-count"></span></h3></div><button class="btn" id="sr-refresh">다시 불러오기</button></div><p class="sr-muted" id="sr-info" role="status">수집 데이터를 확인하고 있습니다.</p><p class="sr-muted">영상 제목의 키워드로 분류합니다. 실제 시청자 연령이나 정보의 신뢰도를 판정한 결과가 아닙니다.</p><div id="sr-results" aria-live="polite"></div></section></section>`;
 document.querySelectorAll('[data-sr-group]').forEach(b=>b.onclick=()=>{SR.group=b.dataset.srGroup;SR.topic='all';SR.query='';pgSenior();});
 document.querySelectorAll('[data-sr-topic]').forEach(b=>b.onclick=()=>{SR.topic=b.dataset.srTopic;pgSenior();});
 $('sr-type').value=SR.type;$('sr-sort').value=SR.sort;$('sr-query').value=SR.query;
 $('sr-type').onchange=e=>{SR.type=e.target.value;srDraw();};$('sr-sort').onchange=e=>{SR.sort=e.target.value;srDraw();};$('sr-query').oninput=e=>{SR.query=e.target.value;srDraw();};
 document.querySelectorAll('[data-sr-search]').forEach(b=>b.onclick=()=>srSearch(b.dataset.srSearch));
 document.querySelectorAll('[data-sr-plan]').forEach(b=>b.onclick=()=>srPlan(b.dataset.srPlan));
 $('sr-refresh').onclick=()=>srLoad();
 if(SR.items!==null)srDraw();else srLoad();
}
function srFind(id){return SENIOR_TOPICS.flatMap(g=>g.topics).find(t=>t.id===id);}
function srSearch(id){const t=srFind(id);S.cat=t.query;S.pick=false;S.sub='all';S.minv='0';S.type=SR.type==='long'?'long':'short';sResults=[];go('search');$('q').value=t.query;$('q').focus();}
function srPlan(id){const t=srFind(id);const box=$('sr-plan');box.hidden=false;box.innerHTML=`<div class="sr-panel"><div class="sr-section-title"><h3>${t.idea}</h3><button class="btn" id="sr-close">닫기</button></div><ol><li><b>도입 · 5초</b> — “${t.name}, 무엇부터 확인하면 좋을까요?”</li><li><b>본문 · 35초</b> — 비용, 조건, 실천 방법 중 주제에 맞는 항목 세 가지를 실제 자료로 설명합니다.</li><li><b>마무리 · 10초</b> — 시청자가 직접 확인할 원출처와 확인 날짜를 화면에 남깁니다.</li></ol><p>준비할 자료: 원문 출처, 적용 대상·예외 조건, 직접 촬영하거나 사용 권한을 확보한 화면. 개인 사례를 모두에게 적용되는 결론으로 표현하지 마세요.</p><button class="btn" id="sr-copy">기획안 복사</button><span id="sr-copy-status" role="status"></span></div>`;
 $('sr-close').onclick=()=>{box.hidden=true;};$('sr-copy').onclick=async()=>{try{await navigator.clipboard.writeText(`${t.idea}\n검색어: ${t.query}\n도입 5초: 시청자의 상황과 질문\n본문 35초: 비용·조건·실천 방법 중 세 가지\n마무리 10초: 원출처와 확인 날짜\n준비 자료: 적용 대상, 예외 조건, 사용 권한을 확보한 화면`);$('sr-copy-status').textContent=' 복사했습니다.';}catch(e){$('sr-copy-status').textContent=' 복사하지 못했습니다. 위 내용을 선택해 복사해주세요.';}};
}
async function srLoad(){const request=++SR.request;put('sr-info','수집 데이터를 확인하고 있습니다.');
 try{let raw;let dedicated=false;try{const res=await fetch('data/senior-radar.json',{cache:'no-store'});if(!res.ok)throw Error();raw=await res.json();dedicated=true;}catch(e){const res=await fetch('data/radar.json',{cache:'no-store'});if(!res.ok)throw Error();raw=await res.json();}
 if(!Array.isArray(raw.items))throw Error('invalid');if(request!==SR.request)return;
 SR.items=raw.items.map(v=>({...v,days:Math.max(1,Math.floor((Date.now()-new Date(v.published).getTime())/86400000))})).map(v=>({...v,daily:Math.round(v.views/v.days)}));SR.error=false;
 SR.info=`${dedicated?'중장년 전용':'기존 레이더'} 수집 데이터 · 마지막 수집 ${raw.collectedAt?new Date(raw.collectedAt).toLocaleString('ko-KR'):'시각 미제공'} · 실시간 검색 아님`;
 }catch(e){if(request!==SR.request)return;SR.error=true;SR.items=[];SR.info='수집 데이터를 불러오지 못했습니다. 다시 불러오거나 주제별 영상 검색을 이용하세요.';}
 if(current==='senior')srDraw();
}
function srDraw(){if(!$('sr-results'))return;let items=(SR.items||[]).filter(srMatches).filter(v=>srText(v.title).includes(srText(SR.query)));
 if(SR.type==='short')items=items.filter(v=>v.dur>0&&v.dur<=180);if(SR.type==='long')items=items.filter(v=>v.dur>180);
 items.sort(SR.sort==='date'?(a,b)=>new Date(b.published)-new Date(a.published):SR.sort==='score'?(a,b)=>(b.score||0)-(a.score||0):(a,b)=>b.views-a.views);
 put('sr-count',`· ${items.length}개`);put('sr-info',esc(SR.info));
 put('sr-results',items.length?`<div class="grid">${items.slice(0,60).map((v,i)=>cardHTML(v,i)).join('')}</div>${items.length>60?'<p class="sr-muted">상위 60개를 표시합니다. 세부 주제나 제목 검색으로 범위를 좁혀보세요.</p>':''}`:`<div class="sr-empty"><h4>${SR.error?'데이터 연결을 확인해주세요':'조건에 맞는 수집 영상이 아직 없어요'}</h4><p>주제별 ‘영상 검색 준비’를 누르면 검색어가 자동 입력됩니다.<br>직접 검색에는 YouTube API 키가 필요합니다.</p><a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(srTopics()[0].query)}">YouTube에서 주제 검색 ↗</a></div>`);
}
