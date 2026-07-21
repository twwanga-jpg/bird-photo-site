ObjC.import('Foundation');
function read(path){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path,$.NSUTF8StringEncoding,null));}
function write(path,text){$(text).writeToFileAtomicallyEncodingError(path,true,$.NSUTF8StringEncoding,null);}
function clean(s){return String(s||'').trim();}
function run(argv){
  if(argv.length<3)throw new Error('Usage: build-catalog.js manifest config output');
  const lines=read(argv[0]).split(/\r?\n/).filter(Boolean);
  const config=JSON.parse(read(argv[1]));
  const photos=lines.map((line,index)=>{
    const p=line.split('\t');
    return {id:p[0],category:p[1],src:p[3],small:p[2],large:p[4],title:clean(p[5])||`作品 ${index+1}`,species:clean(p[6]),location:clean(p[7]),year:clean(p[8]),alt:[p[5],p[6],p[7],p[8]].filter(Boolean).join('，'),featured:index===0};
  });
  write(argv[2],JSON.stringify({site:config,updatedAt:new Date().toISOString(),photos},null,2)+'\n');
  return `Generated ${photos.length} photos`;
}
