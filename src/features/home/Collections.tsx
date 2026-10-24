import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadFrames, loadFurniture } from '../../shared/catalog';
import type { Frame, Furniture } from '../../shared/types';
export default function Collections(){
 const [frames,setFrames]=useState<Frame[]>([]);const [items,setItems]=useState<Furniture[]>([]);const [error,setError]=useState(false);
 useEffect(()=>{let live=true;Promise.all([loadFrames(),loadFurniture()]).then(([f,i])=>{if(live){setFrames(f);setItems(i);}}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[]);
 return <>
 <div className="edit-benefits"><span>01 <strong>Discover your style</strong></span><span>02 <strong>Experience it in 3D</strong></span><span>03 <strong>See it in your world</strong></span></div>
 <section className="edit-collection" aria-labelledby="frames-heading"><div className="edit-section-heading"><div><span className="shell-eyebrow">THE EYEWEAR EDIT</span><h2 id="frames-heading">A frame for every version of you.</h2></div><Link to="/tryon">Try the collection <span aria-hidden="true">↗</span></Link></div>
 {error?<p role="status">The collection is unavailable. <Link to="/tryon">Open Virtual Try-On</Link></p>:frames.length===0?<p role="status">Loading the collection…</p>:<div className="edit-product-grid">{frames.map((frame,index)=><Link className="edit-product" key={frame.id} to="/tryon"><div className="edit-product-image"><span className="edit-product-number">0{index+1} / EYEWEAR</span><img src={frame.thumb} alt={frame.name} width="256" height="256" loading="lazy"/><span className="edit-product-action">Try it on <span aria-hidden="true">↗</span></span></div><h3>{frame.name}</h3><p>Explore in virtual try-on</p></Link>)}</div>}</section>
 <section className="edit-room" aria-labelledby="room-heading"><div className="edit-room-copy"><span className="shell-eyebrow">ROOM TO IMAGINE</span><h2 id="room-heading">Good design.<br/><em>Right at home.</em></h2><p>Find a new perspective on your space. Explore furniture and decor in 3D, then see how it fits with room AR.</p><Link className="reality-btn-primary" to="/ar">Step inside AR Studio ↗</Link><span className="edit-room-note">Explore real dimensions. Make room for possibilities.</span></div><div className="edit-room-products">{items.slice(0,2).map(item=><Link to="/ar" key={item.id}><img src={item.thumb} width="256" height="256" alt={item.name} loading="lazy"/><span>{item.name} <span aria-hidden="true">↗</span></span><small>{item.size.w.toFixed(2)}m × {item.size.h.toFixed(2)}m</small></Link>)}</div></section>
 </>;
}
