const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const storage=new Map();const context=vm.createContext({URL,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){},getElementById(){return null;}},window:{addEventListener(){}},confirm:()=>true,go:()=>{}});
vm.runInContext(fs.readFileSync('production.js','utf8'),context);
for(const url of ['https://youtu.be/Y4gvmTGahv8','https://www.youtube.com/shorts/Y4gvmTGahv8','https://youtube.com/watch?v=Y4gvmTGahv8&t=20'])assert.equal(vm.runInContext(`avURL(${JSON.stringify(url)})`,context),'https://www.youtube.com/watch?v=Y4gvmTGahv8');
for(const bad of ['javascript:alert(1)','https://youtube.com.attacker.example/watch?v=Y4gvmTGahv8','https://youtube.com/channel/test'])assert.throws(()=>vm.runInContext(`avURL(${JSON.stringify(bad)})`,context));
vm.runInContext(`avSelect({id:'Y4gvmTGahv8',title:'<script>literal text</script>',channel:'테스트'});avDraft.script='한국어 테스트 대본';avDraft.targetMinutes=3;avDraft.vertical=true;avSave();`,context);
const data=JSON.parse(vm.runInContext('JSON.stringify(avPayload())',context));assert.equal(data.title,'<script>literal text</script>');assert.equal(data.script,'한국어 테스트 대본');assert.equal(data.version,1);assert.equal(data.vertical,true);assert.equal(data.targetMinutes,3);assert.deepEqual(Object.keys(data).sort(),['channel','script','targetMinutes','title','url','version','vertical']);
console.log('PASS: YouTube URL validation, selected-video handoff, schema and draft persistence; no credentials exported');
