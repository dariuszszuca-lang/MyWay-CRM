// Narrow Firestore adapter: reads and atomic create-only commits. No update/delete API.
const encode=v=>v===null?{nullValue:null}:v instanceof Date?{timestampValue:v.toISOString()}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):{stringValue:String(v)};
const decode=v=>'nullValue'in v?null:'timestampValue'in v?new Date(v.timestampValue):'arrayValue'in v?(v.arrayValue.values||[]).map(decode):'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):'booleanValue'in v?v.booleanValue:'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:v.stringValue??v.referenceValue;
export function firestoreImportRest({project,token,host='https://firestore.googleapis.com'}) {
 if(project!=='myway-crm-a4593'&&!project.startsWith('demo-'))throw Error('Unexpected target');
 if(host!=='https://firestore.googleapis.com'&&!host.startsWith('http://127.0.0.1:'))throw Error('Unexpected API host');
 const root=`projects/${project}/databases/(default)/documents`;
 const request=async(path,body)=>{
  const r=await fetch(`${host}/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===404&&!body)return null;
  const json=await r.json();if(!r.ok)throw Error(`Firestore ${r.status}: ${json.error?.message||'Request failed'}`);return json;
 };
 const snap=d=>({id:d.name.split('/').at(-1),name:d.name,exists:true,data:()=>Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]))});
 const write=(ref,data)=>({update:{name:ref.name,fields:encode(data).mapValue.fields},currentDocument:{exists:false}});
 const db={
  doc(path){
   if(!/^phone[A-Za-z]+\/[A-Za-z0-9_-]+$/.test(path))throw Error('Import only supports phone collections');
   const name=root+'/'+path;
   return {name,get:async()=>{const d=await request(name);return d?snap(d):{exists:false};},create:async data=>request(root+':commit',{writes:[write({name},data)]})};
  },
  collection(name){
   if(!/^phone[A-Za-z]+$/.test(name))throw Error('Import only supports phone collections');
   const q={cap:1000,cursor:null,orderBy(field){if(field!=='__name__')throw Error('Unsupported ordering');return this;},limit(n){this.cap=n;return this;},startAfter(c){this.cursor=c;return this;},async get(){
    const query={from:[{collectionId:name}],orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:this.cap,...(this.cursor?{startAt:{before:false,values:[{referenceValue:this.cursor.name}]}}:{})};
    const result=await request(root+':runQuery',{structuredQuery:query});const docs=result.filter(r=>r.document).map(r=>snap(r.document));return {docs,size:docs.length};
   }};return q;
  },
  batch(){const writes=[];return {create(ref,data){writes.push(write(ref,data));},commit:()=>request(root+':commit',{writes})};},
  terminate:async()=>{},
 };
 return db;
}
