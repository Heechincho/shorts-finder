const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),session=new Map();
const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:true,disabled:false,style:{},setAttribute(){}});return elements.get(id);};
let request,status=200;
const context=vm.createContext({URL,console,AbortController,setTimeout,clearTimeout,localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},document:{addEventListener(){},getElementById:el,querySelectorAll(){return []}},window:{addEventListener(){}},fetch:async(url,options)=>{request={url,options};return {status,ok:status===200,json:async()=>({videos:[]})}}});
vm.runInContext(fs.readFileSync('production.js','utf8'),context);vm.runInContext('pgProduction()',context);
(async()=>{
await el('avPexelsCheck').onclick();assert.equal(request,undefined);assert.match(el('avPexelsStatus').textContent,/입력하세요/);
el('avPexelsKey').value='test-key-not-a-secret';el('avPexelsSave').onclick();el('avPexelsKey').value='';el('avPexelsLoad').onclick();assert.equal(el('avPexelsKey').value,'test-key-not-a-secret');
await el('avPexelsCheck').onclick();assert.equal(request.options.headers.Authorization,'test-key-not-a-secret');assert.equal(request.url,'https://api.pexels.com/v1/videos/search?query=nature&per_page=1');assert.match(el('avPexelsStatus').textContent,/성공/);assert.equal(el('avPexelsCheck').disabled,false);
status=401;await el('avPexelsCheck').onclick();assert.match(el('avPexelsStatus').textContent,/인증에 실패/);assert.equal(el('avPexelsCheck').disabled,false);
vm.runInContext("avDraft.url='https://www.youtube.com/watch?v=Y4gvmTGahv8'",context);assert.ok(!vm.runInContext('JSON.stringify(avPayload())',context).includes('test-key-not-a-secret'));
console.log('PASS: missing key, session save/load, request authorization, success/error handling and credential exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
