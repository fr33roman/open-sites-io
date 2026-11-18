// bench-gorod.mjs — замер кадров и вызовов отрисовки «Города»: node bench-gorod.mjs <ширина> <замедление ЦП> <old|full>
// old — сохранение старого вида (10 зданий, по одному каждого вида; для новой версии это проверка переноса); full — застроенная карта из 40 построек
import { open, sleep } from '../../_shots/akcii-obuchenie/drv.mjs';
import { createRequire } from 'node:module';
const G = createRequire(import.meta.url)('../gorod.js');
const W = +(process.argv[2] || 481), THR = +(process.argv[3] || 1), MODE = process.argv[4] || 'new', mob = W < 700;
const URL = 'http://127.0.0.1:8933/akcii/index.html';
const d = await open({ w: W, h: 900, dpr: 1, mobile: mob, url: URL });
await d.go('about:blank'); await d.go(URL);
await d.ev(`DofaSim.give(1)`);
const OLD10 = `s.xp=999999; s.cash=9e9; s.les={}; for (let i=1;i<=10;i++) s.les[i]=1; s.city={b:{}, 'in':0,out:0,streak:0,last:-1}; const ids=['kiosk','exch','dc','hall','bank','lab','fund','tower','inst','obs']; ids.forEach((k,i)=>{ s.city.b[k]={l:[5,4,5,3,5,4,2,5,3,5][i], t:Date.now()-(i+1)*3600e3}; })`;
const full = (() => { const Sx = { cash: 1e12, city: null }; G.norm(Sx); [1, 2, 3, 4, 5].forEach(k => Sx.city.d.push(k)); const T0 = Date.now();
  ['hall', 'kiosk', 'kiosk', 'kiosk', 'exch', 'exch', 'vend', 'atm', 'dc', 'pay', 'bank', 'park', 'park', 'park', 'park', 'fountain', 'home', 'home', 'cowork', 'mall', 'broker', 'lab', 'fund', 'tower', 'inst', 'vc', 'port', 'port', 'maglev', 'obs', 'atm', 'pay', 'home', 'home', 'cowork', 'park', 'park', 'exch', 'dc', 'kiosk'].forEach((id, i) => { const b = G.BY[id], near = i % 3 === 0 ? { x: 6, z: 10 } : i % 3 === 1 ? { x: 11, z: 20 } : { x: 11, z: 4 }; const sp = G.findSpot(Sx.city, b, near); if (!sp) return; if (G.place(Sx, id, 10, T0, sp.x, sp.y, sp.r).ok) { const it = Sx.city.p[Sx.city.p.length - 1]; it.l = 1 + (i * 7) % 5; it.t = T0 - (1 + i % 9) * 3600e3; } });
  return Sx.city; })();
const st = MODE === 'old' ? OLD10 : `s.xp=999999; s.cash=9e9; s.les={}; for (let i=1;i<=10;i++) s.les[i]=1; s.city=${JSON.stringify(full)}`;
await d.ev(`(()=>{const s=JSON.parse(localStorage.getItem('dofa_sim_v1')); ${st}; Storage.prototype.setItem.call(localStorage,'dofa_sim_v1',JSON.stringify(s)); localStorage.setItem=()=>{}; return 1})()`);
await d.go('about:blank'); await d.go(URL + '#gorod'); await sleep(2500);
if (THR > 1) await d.send('Emulation.setCPUThrottlingRate', { rate: THR });
await sleep(500);
const b = await d.ev(`DofaGorod3D.bench(5000)`);
const inf = await d.ev(`DofaGorod3D.info()`);
console.log(W, 'x' + THR, MODE, JSON.stringify(b), JSON.stringify(inf), JSON.stringify(d.errs.slice(0, 3)));
d.close();
