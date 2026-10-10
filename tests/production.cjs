const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const storage=new Map();const context=vm.createContext({URL,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){},getElementById(){return null;}},window:{addEventListener(){}},confirm:()=>true,go:()=>{}});
vm.runInContext(fs.readFileSync('production.js','utf8'),context);
for(const url of ['https://youtu.be/Y4gvmTGahv8','https://www.youtube.com/shorts/Y4gvmTGahv8','https://youtube.com/watch?v=Y4gvmTGahv8&t=20'])assert.equal(vm.runInContext(`avURL(${JSON.stringify(url)})`,context),'https://www.youtube.com/watch?v=Y4gvmTGahv8');
for(const bad of ['javascript:alert(1)','https://youtube.com.attacker.example/watch?v=Y4gvmTGahv8','https://youtube.com/channel/test'])assert.throws(()=>vm.runInContext(`avURL(${JSON.stringify(bad)})`,context));
vm.runInContext(`avSelect({id:'Y4gvmTGahv8',title:'<script>literal text</script>',channel:'테스트'});avDraft.script='한국어 테스트 대본';avDraft.targetMinutes=3;avDraft.vertical=true;avSave();`,context);
const data=JSON.parse(vm.runInContext('JSON.stringify(avPayload())',context));assert.equal(data.title,'<script>literal text</script>');assert.equal(data.script,'한국어 테스트 대본');assert.equal(data.version,2);assert.equal(data.vertical,true);assert.equal(data.targetMinutes,3);assert.deepEqual(Object.keys(data).sort(),['channel','options','script','step','targetMinutes','title','transcript','url','version','vertical']);
console.log('PASS: YouTube URL validation, selected-video handoff, schema and draft persistence; no credentials exported');

assert.throws(()=>vm.runInContext("avValidateScript('/Users/test/Desktop/screenshot.png')",context));
vm.runInContext("avValidateScript('한국어 내레이션입니다.');avOptions.quality=1080;avOptions.creditPosition='오른쪽 아래';avOptions.subtitleBox=false;avStep='5';",context);
const styled=JSON.parse(vm.runInContext('JSON.stringify(avPayload())',context));assert.equal(styled.options.quality,1080);assert.equal(styled.options.creditPosition,'오른쪽 아래');assert.equal(styled.options.subtitleBox,false);assert.equal(styled.step,'5');
console.log('PASS: screenshot path rejection and style/step transfer');
