// Runs in the inspected page. Only geometry and control labels leave the page;
// input values, cookies and keyboard events are deliberately never collected.
export const startInteractionCapture = `(() => {
  window.__cueStopInteractions?.();
  const mask = '[data-cue-mask],input[type=password],input[type=email],[autocomplete=cc-number]';
  const style = document.createElement('style');
  style.textContent = mask.split(',').map(s=>s+','+s+' *').join(',')+'{visibility:hidden!important}';
  document.documentElement.append(style);
  let lastScroll=0,lastPointer=0;
  const emit = value => { try {window.__cueInteraction(JSON.stringify(value))} catch {} };
  const click = e => {
    const el=e.target.closest('button,a,[role=button],input,select') || e.target;
    if(el.closest(mask) || el.querySelector(mask)) return;
    const label=(el.getAttribute('aria-label') || (el.matches('button,a,[role=button]') ? el.textContent : el.tagName.toLowerCase()) || '').trim().slice(0,100);
    emit({type:'click',label,x:Math.min(1,Math.max(0,e.clientX/innerWidth)),y:Math.min(1,Math.max(0,e.clientY/innerHeight))});
  };
  const scroll = () => {if(Date.now()-lastScroll>800){lastScroll=Date.now();emit({type:'scroll',label:'Scroll'})}};
  const pointer=e=>{if(Date.now()-lastPointer>500){lastPointer=Date.now();emit({type:'pointer',label:'',x:Math.min(1,Math.max(0,e.clientX/innerWidth)),y:Math.min(1,Math.max(0,e.clientY/innerHeight))})}};
  const focus=e=>{if(e.target.closest(mask)||e.target.querySelector?.(mask))return;const r=e.target.getBoundingClientRect();emit({type:'focus',label:(e.target.getAttribute('aria-label')||e.target.tagName.toLowerCase()).slice(0,100),x:Math.min(1,Math.max(0,(r.left+r.width/2)/innerWidth)),y:Math.min(1,Math.max(0,(r.top+r.height/2)/innerHeight))})};
  document.addEventListener('pointermove',pointer,true);
  document.addEventListener('focusin',focus,true);
  document.addEventListener('click',click,true);
  document.addEventListener('scroll',scroll,true);
  window.__cueStopInteractions=()=>{document.removeEventListener('pointermove',pointer,true);document.removeEventListener('focusin',focus,true);document.removeEventListener('click',click,true);document.removeEventListener('scroll',scroll,true);style.remove();delete window.__cueStopInteractions};
  return true;
})()`;
export const stopInteractionCapture = "window.__cueStopInteractions?.();true";
