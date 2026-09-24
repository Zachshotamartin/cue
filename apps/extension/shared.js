export function normalizeRoute(href, base) {
  try {
    const u = new URL(href, base);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.origin !== new URL(base).origin ||
      /\.(pdf|zip|png|jpe?g|webp|svg|mp4|mp3)$/i.test(u.pathname) ||
      /\/(logout|signout|delete|remove|unsubscribe|checkout|purchase|publish|payment)(\/|$)/i.test(
        u.pathname,
      )
    )
      return null;
    for (const k of [...u.searchParams.keys()])
      if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    if (
      [...u.searchParams.entries()].some(
        ([k, v]) =>
          /^(action|command|do)$/i.test(k) &&
          /delete|logout|remove|unsubscribe|signout/i.test(v),
      )
    )
      return null;
    u.username = "";
    u.password = "";
    u.searchParams.sort();
    return u.href;
  } catch {
    return null;
  }
}
export function family(url) {
  const u = new URL(url);
  return (
    u.pathname
      .split("/")
      .map((x) => (/^\d+$|^[0-9a-f-]{20,}$/i.test(x) ? ":id" : x))
      .join("/") + u.hash
  );
}
export const evidenceExpression = `(() => { const visible = e => {const r=e.getBoundingClientRect();return r.width>3&&r.height>3&&getComputedStyle(e).visibility!=='hidden'}; const masks=[...document.querySelectorAll('[data-cue-mask],input[type=password],input[type=email],[autocomplete=cc-number]')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}); const hidden=e=>masks.some(r=>{const b=e.getBoundingClientRect();return b.x<r.x+r.width&&b.x+b.width>r.x&&b.y<r.y+r.height&&b.y+b.height>r.y}); const headings=[...document.querySelectorAll('h1,h2,h3,[role=heading]')].filter(e=>visible(e)&&!hidden(e)).slice(0,25).map(e=>e.textContent.trim().slice(0,180)); const links=[...document.querySelectorAll('a[href]')].filter(e=>visible(e)&&!hidden(e)).map(e=>({href:e.href,label:e.innerText.trim().slice(0,100)})).slice(0,200); const colors=[...new Set([...document.querySelectorAll('button,a,h1,h2,main')].filter(visible).slice(0,80).flatMap(e=>[getComputedStyle(e).color,getComputedStyle(e).backgroundColor]))].slice(0,12); const hex=c=>{const n=c.match(/[0-9.]+/g);return n&&n.length>=3?'#'+n.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(+v))).toString(16).padStart(2,'0')).join(''):null};return {url:location.href,title:document.title,text:headings.join('\\n'),links,colors:colors.map(hex).filter(Boolean),masks,viewport:{width:innerWidth,height:innerHeight}};})()`;
export const maskPickerExpression = `(() => {window.__cueStopPicker?.();let outline=document.createElement('div');Object.assign(outline.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483647',border:'2px solid #df603c',background:'#df603c22'});document.documentElement.append(outline);const hover=e=>{const r=e.target.getBoundingClientRect();Object.assign(outline.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'})};const click=e=>{e.preventDefault();e.stopImmediatePropagation();e.target.setAttribute('data-cue-mask','true');e.target.style.setProperty('outline','2px solid #df603c');stop()};const key=e=>{if(e.key==='Escape')stop()};const stop=()=>{document.removeEventListener('pointermove',hover,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);outline.remove();delete window.__cueStopPicker};window.__cueStopPicker=stop;document.addEventListener('pointermove',hover,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);return true})()`;
export async function saveBlob(id, blob, metadata) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction("captures", "readwrite");
    t.objectStore("captures").put({ id, blob, metadata });
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
  db.close();
}
export async function getBlob(id) {
  const db = await openDb();
  const r = await new Promise((resolve, reject) => {
    const t = db.transaction("captures");
    const q = t.objectStore("captures").get(id);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  db.close();
  return r;
}
export async function removeBlob(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction("captures", "readwrite");
    t.objectStore("captures").delete(id);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
  db.close();
}
export async function allBlobs() {
  const db = await openDb();
  const r = await new Promise((resolve, reject) => {
    const q = db.transaction("captures").objectStore("captures").getAll();
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  db.close();
  return r;
}
function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("cue-captures", 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("captures"))
        db.createObjectStore("captures", { keyPath: "id" });
      if (!db.objectStoreNames.contains("recordings"))
        db.createObjectStore("recordings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("chunks"))
        db.createObjectStore("chunks", { keyPath: "key" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function writeStore(store, value) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).put(value);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
async function readStore(store) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const q = db.transaction(store).objectStore(store).getAll();
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  } finally {
    db.close();
  }
}
export const beginRecording = (id, metadata) =>
  writeStore("recordings", { id, metadata });
export const appendRecordingChunk = (id, index, blob) =>
  writeStore("chunks", { key: `${id}:${index}`, id, index, blob });
export async function discardRecording(id) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction(["recordings", "chunks"], "readwrite");
      t.objectStore("recordings").delete(id);
      const cursor = t.objectStore("chunks").openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          if (c.value.id === id) c.delete();
          c.continue();
        }
      };
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
export async function finishRecording(id, recovered = false) {
  const record = (await readStore("recordings")).find((r) => r.id === id);
  if (!record) return false;
  const chunks = (await readStore("chunks"))
    .filter((c) => c.id === id)
    .sort((a, b) => a.index - b.index);
  if (chunks.length) {
    await saveBlob(
      id,
      new Blob(
        chunks.map((c) => c.blob),
        { type: "video/webm" },
      ),
      {
        ...record.metadata,
        ...(recovered
          ? {
              warnings: [
                "Recovered after an interrupted recording. Review the complete clip before uploading.",
              ],
            }
          : {}),
      },
    );
  }
  await discardRecording(id);
  return chunks.length > 0;
}
export async function recoverRecordings() {
  const ids = [];
  for (const record of await readStore("recordings"))
    if (await finishRecording(record.id, true)) ids.push(record.id);
  return ids;
}
