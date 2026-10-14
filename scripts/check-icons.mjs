import * as L from 'lucide-react';
import fs from 'node:fs';
import path from 'node:path';
const root='client/src';
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p); else if(/\.(jsx?|js)$/.test(e.name))files.push(p);}})(root);
const missing=new Map();
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  const re=/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g;
  let m;
  while((m=re.exec(src))){
    for(let part of m[1].split(',')){
      part=part.trim(); if(!part)continue;
      const name=part.split(/\s+as\s+/)[0].trim();
      if(!L[name]) { if(!missing.has(name))missing.set(name,[]); missing.get(name).push(f); }
    }
  }
}
if(missing.size===0)console.log('all lucide icons ok');
else for(const [n,fs2] of missing) console.log('MISSING',n,'->',[...new Set(fs2)].join(', '));
