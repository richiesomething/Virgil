// Flags sea legs that cross land on a book's geo basemaps.
// Run after merge-data and build-basemaps. Usage: node scripts/atlas/check-legs.mjs <book>
// Some crossings are intended (canals, fictional tunnels, islands marked by a point on land): read the list, don't just clear it.
import {readFileSync} from 'fs'
const B=`src/books/${process.argv[2]}/`
const data=JSON.parse(readFileSync(B+'data.json','utf8'))
const at=data.atlas
const frames=at.frames.filter(f=>f.type==='geo').map(f=>({f,g:JSON.parse(readFileSync(B+'atlas/'+f.id+'.json','utf8'))}))
const area=f=>(f.bounds[1][0]-f.bounds[0][0])*(f.bounds[1][1]-f.bounds[0][1])
frames.sort((a,b)=>area(a.f)-area(b.f))
const pip=(x,y,ring)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!=(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
const inPoly=(x,y,poly)=>pip(x,y,poly[0])&&!poly.slice(1).some(h=>pip(x,y,h))
const onLand=(x,y)=>{const fr=frames.find(({f})=>x>=f.bounds[0][0]&&x<=f.bounds[1][0]&&y>=f.bounds[0][1]&&y<=f.bounds[1][1]);if(!fr)return false;return fr.g.land.some(p=>inPoly(x,y,p))&&!(fr.g.water||[]).some(p=>inPoly(x,y,p))}
const P=Object.fromEntries(at.places.map(p=>[p.id,p]))
const km=(a,b)=>{const R=6371,r=Math.PI/180;const dl=(b[1]-a[1])*r,dn=(b[0]-a[0])*r;const h=Math.sin(dl/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
for(const j of at.journeys)for(const l of j.legs){if(l.mode!=='sea')continue;const a=P[l.from].lonlat,b=P[l.to].lonlat;if(!a||!b){console.log('nolonlat',l.from,l.to);continue}
 const pts=[a,...(l.via||[]),b];const bad=[]
 for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i];if(Math.abs(p[0]-q[0])>180)continue;const n=Math.max(2,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/0.03));for(let k=0;k<=n;k++){const x=p[0]+(q[0]-p[0])*k/n,y=p[1]+(q[1]-p[1])*k/n;if(km([x,y],a)<40||km([x,y],b)<40)continue;if(onLand(x,y))bad.push(`seg${i}@${x.toFixed(2)},${y.toFixed(2)}`)}}
 if(bad.length)console.log(l.chapter,l.from,'->',l.to,bad.length,bad.slice(0,4).join(' '),bad.length>4?'... '+bad.at(-1):'')}
