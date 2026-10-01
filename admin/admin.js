(()=>{
  const ALL_KINDS=[
    {key:'applications',label:'Applications'},
    {key:'messages',label:'Messages'},
    {key:'talent-requests',label:'Talent Requests'},
    {key:'chat-captures',label:'Chat Captures'},
    {key:'jobs',label:'Jobs'},
    {key:'sync',label:'Job Sync'},
    {key:'content',label:'Content'},
    {key:'pages',label:'Page Content'}
  ];
  const KINDS=window.SOURCETX_PHP_ADMIN?ALL_KINDS.filter(k=>!['sync','content','pages'].includes(k.key)):ALL_KINDS;
  let state={tab:'applications',data:[],filter:'all',query:'',pageFile:null};
  const tabs=document.getElementById('tabs'),view=document.getElementById('view'),modal=document.getElementById('modal'),modalCard=document.getElementById('modalCard');

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=s=>{if(!s)return'';const d=new Date(s);return isNaN(d)?s:d.toLocaleString()};
  const api=async(path,opts)=>{const headers={'Content-Type':'application/json'};if(window.SOURCETX_CSRF)headers['X-CSRF-Token']=window.SOURCETX_CSRF;const res=await fetch(path,{...opts,headers:{...headers,...((opts&&opts.headers)||{})}});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.message||`Request failed (${res.status})`);return json};
  function toast(msg,isErr){
    const el=document.createElement('div');
    el.className='toast'+(isErr?' err':'');
    el.textContent=msg;
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300)},2600);
  }

  function renderTabs(){
    tabs.innerHTML=KINDS.map(k=>`<button class="tab${state.tab===k.key?' active':''}" data-tab="${k.key}">${k.label}</button>`).join('');
    tabs.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  }

  function switchTab(tab){
    state.tab=tab;state.query='';state.filter='all';state.data=[];
    renderTabs();load();
  }

  async function load(){
    view.innerHTML='<p class="empty">Loading…</p>';
    try{
      const res=await api(`/api/admin/${state.tab}`);
      state.data=res.data||[];
      render();
    }catch(e){
      view.innerHTML=`<p class="empty" style="color:var(--danger)">${esc(e.message)}</p>`;
    }
  }

  function render(){
    if(state.tab==='jobs')return renderJobs();
    if(state.tab==='sync')return renderSync();
    if(state.tab==='content')return renderContent();
    if(state.tab==='pages')return renderPages();
    const rows=filterRows();
    const q=esc(state.query);
    const csvLink=`/admin/export/${state.tab}.csv`;
    view.innerHTML=`
      <div class="toolbar">
        <input type="search" id="search" placeholder="Search name, email, or message…" value="${q}">
        <select id="filter">
          <option value="all"${state.filter==='all'?' selected':''}>All</option>
          <option value="unread"${state.filter==='unread'?' selected':''}>Unread</option>
          <option value="read"${state.filter==='read'?' selected':''}>Read</option>
        </select>
        <a class="btn" href="${csvLink}">Export CSV</a>
      </div>
      <div id="list">${rows.length?rows.map(cardFor()).join(''):'<p class="empty">No records found.</p>'}</div>`;
    document.getElementById('search').addEventListener('input',e=>{state.query=e.target.value;rerenderList()});
    document.getElementById('filter').addEventListener('change',e=>{state.filter=e.target.value;rerenderList()});
  }

  function cardFor(){return state.tab==='applications'?cardApplication:state.tab==='chat-captures'?cardChat:cardGeneric;}

  function rerenderList(){
    const rows=filterRows();
    document.getElementById('list').innerHTML=rows.length?rows.map(cardFor()).join(''):'<p class="empty">No records found.</p>';
  }

  function filterRows(){
    const q=state.query.toLowerCase();
    return state.data.filter(r=>{
      if(state.filter==='unread'&&r.read)return false;
      if(state.filter==='read'&&!r.read)return false;
      if(!q)return true;
      return JSON.stringify(r).toLowerCase().includes(q);
    });
  }

  function repliesHtml(r){
    if(!r.replies||!r.replies.length)return'';
    return `<div class="replies">${r.replies.map(p=>`<div class="reply"><div class="rhead">Replied to ${esc(p.to)} · ${esc(fmtDate(p.at))} · ${esc(p.subject)}</div>${esc(p.body)}</div>`).join('')}</div>`;
  }

  function actionsHtml(r){
    const reply=state.tab==='chat-captures'?'':`<button class="btn small" data-action="reply">Reply</button>`;
    return `<div class="actions">${reply}
      <button class="btn small" data-action="read">Mark ${r.read?'Unread':'Read'}</button>
    </div>`;
  }

  function cardChat(r){
    const who=r.email?esc(r.email):'<span class="muted">No email</span>';
    return `<article class="panel${r.read?'':' unread'}">
      <div class="head"><div><span class="dot ${r.read?'read':'unread'}"></span><span class="who">Unanswered chat question</span>
        <div class="meta">${who} · ${esc(fmtDate(r.submittedAt))}${r.intent&&r.intent!=='none'?' · intent: '+esc(r.intent):''}</div></div></div>
      <div class="body">${esc(r.question||'—')}</div>${actionsHtml(r)}
    </article>`;
  }

  function cardGeneric(r){
    const title=r.company?`${esc(r.company)}`:(r.topic?esc(r.topic):esc(r.name));
    const who=r.company?`${esc(r.name)} (${esc(r.email)})`:esc(r.email);
    const extra=r.service||r.targetDate?`<div class="kv">${[r.service,r.targetDate].filter(Boolean).map(esc).join(' · ')}</div>`:'';
    const body=r.needs||r.message;
    const attachment=r.attachment?`<a class="btn small" href="/api/admin/messages/${encodeURIComponent(r.id)}/attachment" target="_blank" rel="noopener">${esc(r.originalAttachmentName||'Attachment')}</a>`:'';
    return `<article class="panel${r.read?'':' unread'}">
      <div class="head"><div><span class="dot ${r.read?'read':'unread'}"></span><span class="who">${title}</span><div class="meta">${who} · ${esc(fmtDate(r.submittedAt))}</div>${extra}</div>${attachment}</div>
      <div class="body">${esc(body)}</div>${repliesHtml(r)}${actionsHtml(r)}
    </article>`;
  }

  function cardApplication(r){
    return `<article class="panel${r.read?'':' unread'}">
      <div class="head">
        <div><span class="dot ${r.read?'read':'unread'}"></span><span class="who">${esc(r.name)}</span>
          <div class="meta">${esc(r.jobTitle)} · ${esc(r.email)} · ${esc(r.phone||'—')}${r.location?' · '+esc(r.location):''} · ${esc(fmtDate(r.submittedAt))}</div>
          ${r.workAuthorization?`<span class="chip">Auth: ${esc(r.workAuthorization)}</span>`:''}${r.linkedin?`<span class="chip">${esc(r.linkedin)}</span>`:''}</div>
        ${r.resume?(window.SOURCETX_PHP_ADMIN?`<a class="btn small" href="${esc(r.resume)}" target="_blank" rel="noopener">Résumé / LinkedIn</a>`:`<a class="btn small" href="/uploads/${encodeURIComponent(r.resume)}" target="_blank">${esc(r.originalResumeName||'CV')}</a>`):''}
      </div>
      <div class="body">${esc(r.message||'—')}</div>${repliesHtml(r)}${actionsHtml(r)}
    </article>`;
  }

  function renderJobs(){
    const jobs=state.data;
    view.innerHTML=`
      <div class="toolbar">
        <button class="btn primary" id="addJob">+ Add Job</button>
        ${window.SOURCETX_PHP_ADMIN?'<button class="btn" id="importJobs">Import JSON</button>':''}
        <a class="btn" href="/">View Jobs Page</a>
      </div>
      <div class="panel"><table class="jobs"><thead><tr><th>Title</th><th>Location</th><th>Type</th><th>Department</th><th>Posted</th><th>Status</th><th></th></tr></thead>
      <tbody>${jobs.length?jobs.map(j=>`<tr>
        <td><strong>${esc(j.title)}</strong></td><td>${esc(j.location)}</td><td>${esc(j.type)}</td><td>${esc(j.department)}</td><td>${esc(j.posted)}</td>
        <td><span class="tag ${j.active!==false?'on':'off'}">${j.active!==false?'Active':'Inactive'}</span></td>
        <td style="white-space:nowrap">
          <button class="btn small" data-job-edit="${esc(j.id)}">Edit</button>
          <button class="btn small" data-job-toggle="${esc(j.id)}">${j.active!==false?'Deactivate':'Activate'}</button>
        </td></tr>`).join(''):'<tr><td colspan="7" class="empty">No jobs yet.</td></tr>'}</tbody></table></div>`;
    document.getElementById('addJob').addEventListener('click',()=>openJobModal(null));
    if(window.SOURCETX_PHP_ADMIN)document.getElementById('importJobs').addEventListener('click',()=>openImportJsonModal());
    view.querySelectorAll('[data-job-edit]').forEach(b=>b.addEventListener('click',()=>openJobModal(jobs.find(j=>j.id===b.dataset.jobEdit))));
    view.querySelectorAll('[data-job-toggle]').forEach(b=>b.addEventListener('click',async()=>{
      const j=jobs.find(x=>x.id===b.dataset.jobToggle);
      try{await api(`/api/admin/jobs/${encodeURIComponent(j.id)}`,{method:'PUT',body:JSON.stringify({active:j.active!==false?false:true})});await load();}
      catch(e){toast(e.message,true)}
    }));
  }

  function openJobModal(job){
    const j=job||{title:'',location:'',type:'',department:'',posted:new Date().toISOString().slice(0,10),summary:'',description:'',responsibilities:[],requirements:[],skills:[],active:true};
    const arr=(v)=>v&&v.length?v.join('\n'):'';
    modalCard.innerHTML=`
      <h2>${job?'Edit Job':'Add Job'}</h2>
      <label>Title *</label><input id="jb-title" type="text" value="${esc(j.title)}">
      <div class="row"><div><label>Location</label><input id="jb-location" type="text" value="${esc(j.location)}"></div>
      <div><label>Type</label><input id="jb-type" type="text" value="${esc(j.type)}"></div></div>
      <div class="row"><div><label>Department</label><input id="jb-dept" type="text" value="${esc(j.department)}"></div>
      <div><label>Posted</label><input id="jb-posted" type="date" value="${esc(j.posted)}"></div></div>
      <label>Summary</label><input id="jb-summary" type="text" value="${esc(j.summary)}">
      <label>Description</label><textarea id="jb-desc" rows="3">${esc(j.description)}</textarea>
      <label>Responsibilities (one per line)</label><textarea id="jb-resp" rows="3">${esc(arr(j.responsibilities))}</textarea>
      <label>Requirements (one per line)</label><textarea id="jb-req" rows="3">${esc(arr(j.requirements))}</textarea>
      <label>Skills (comma separated)</label><input id="jb-skills" type="text" value="${esc(j.skills&&j.skills.join(', '))}">
      <div class="actions">
        <button class="btn" id="jb-cancel">Cancel</button>
        <button class="btn primary" id="jb-save">${job?'Save':'Create'}</button>
      </div>
      <p class="status" id="jb-status"></p>`;
    modal.classList.add('open');
    const split=v=>v.split(/\n/).map(s=>s.trim()).filter(Boolean);
    const collect=()=>({
      title:document.getElementById('jb-title').value.trim(),
      location:document.getElementById('jb-location').value.trim(),
      type:document.getElementById('jb-type').value.trim(),
      department:document.getElementById('jb-dept').value.trim(),
      posted:document.getElementById('jb-posted').value,
      summary:document.getElementById('jb-summary').value.trim(),
      description:document.getElementById('jb-desc').value.trim(),
      responsibilities:split(document.getElementById('jb-resp').value),
      requirements:split(document.getElementById('jb-req').value),
      skills:document.getElementById('jb-skills').value.split(',').map(s=>s.trim()).filter(Boolean)
    });
    document.getElementById('jb-cancel').addEventListener('click',()=>modal.classList.remove('open'));
    document.getElementById('jb-save').addEventListener('click',async()=>{
      const body=collect();const st=document.getElementById('jb-status');
      if(!body.title){st.className='status err';st.textContent='Title is required.';return}
      try{
        if(job)await api(`/api/admin/jobs/${encodeURIComponent(job.id)}`,{method:'PUT',body:JSON.stringify(body)});
        else await api('/api/admin/jobs',{method:'POST',body:JSON.stringify(body)});
        modal.classList.remove('open');await load();
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  function openImportJsonModal(){
    modalCard.innerHTML=`
      <h2>Import Jobs from JSON</h2>
      <p class="hint">Paste a JSON array of jobs. A job is added only when its <code>id</code> is not already present; existing jobs are left unchanged.</p>
      <textarea id="ij-text" rows="10" placeholder='[{"id":"senior-data-engineer","title":"Senior Data Engineer","skills":["SQL"]}]'></textarea>
      <input type="file" id="ij-file" accept=".json,application/json">
      <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="ij-dry" style="width:auto"> Dry run (validate only, save nothing)</label>
      <div class="actions">
        <button class="btn" id="ij-cancel">Cancel</button>
        <button class="btn primary" id="ij-run">Import</button>
      </div>
      <p class="status" id="ij-status"></p>`;
    modal.classList.add('open');
    document.getElementById('ij-file').addEventListener('change',e=>{
      const f=e.target.files[0];if(!f)return;
      const rd=new FileReader();
      rd.onload=()=>{document.getElementById('ij-text').value=rd.result};
      rd.readAsText(f);
    });
    document.getElementById('ij-cancel').addEventListener('click',()=>modal.classList.remove('open'));
    document.getElementById('ij-run').addEventListener('click',async()=>{
      const st=document.getElementById('ij-status');
      const text=document.getElementById('ij-text').value.trim();
      if(!text){st.className='status err';st.textContent='Paste JSON first.';return}
      st.className='status';st.textContent='Importing…';
      const dryRun=document.getElementById('ij-dry').checked;
      try{
        const res=await api('/api/admin/jobs/import',{method:'POST',body:JSON.stringify({text,dryRun})});
        st.className='status ok';st.textContent=res.data.message;
        if(!dryRun)setTimeout(()=>{modal.classList.remove('open');load()},1200);
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  function renderSync(){
    const d=state.data||{jobs:[],staleDays:60};
    const jobs=d.jobs||[];
    view.innerHTML=`
      <div class="toolbar">
        <button class="btn primary" id="syncImport">+ Import Jobs</button>
        <a class="btn" href="/">View Jobs Page</a>
      </div>
      <p class="empty" style="text-align:left;margin:0 0 12px">Postings are hidden from the public jobs list once inactive. Openings tracked through Job Sync are auto-closed after ${esc(d.staleDays)} days without a refresh (refreshing or re-importing reactivates them).</p>
      <div class="panel"><table class="jobs"><thead><tr><th>Title</th><th>Location</th><th>Source</th><th>Last refreshed</th><th>Posted</th><th>Status</th><th></th></tr></thead>
      <tbody>${jobs.length?jobs.map(j=>`<tr>
        <td><strong>${esc(j.title)}</strong>${j.sourceUrl?`<div class="muted" style="font-size:12px">${esc(j.sourceUrl)}</div>`:''}</td>
        <td>${esc(j.location)}</td><td>${esc(j.source||'legacy')}</td><td>${esc(j.lastRefreshed||'—')}</td><td>${esc(j.posted)}</td>
        <td><span class="tag ${j.active!==false?'on':'off'}">${j.active!==false?'Active':(j.closedReason==='stale'?'Auto-closed':'Inactive')}</span></td>
        <td style="white-space:nowrap">
          <button class="btn small" data-job-edit="${esc(j.id)}">Edit</button>
          <button class="btn small" data-job-toggle="${esc(j.id)}">${j.active!==false?'Deactivate':'Activate'}</button>
        </td></tr>`).join(''):'<tr><td colspan="7" class="empty">No jobs yet — import or add one.</td></tr>'}</tbody></table></div>`;
    document.getElementById('syncImport').addEventListener('click',()=>openImportModal());
    view.querySelectorAll('[data-job-edit]').forEach(b=>b.addEventListener('click',()=>openJobModal((jobs.find(j=>j.id===b.dataset.jobEdit))||null)));
    view.querySelectorAll('[data-job-toggle]').forEach(b=>b.addEventListener('click',async()=>{
      const j=jobs.find(x=>x.id===b.dataset.jobToggle);
      try{await api(`/api/admin/jobs/${encodeURIComponent(j.id)}`,{method:'PUT',body:JSON.stringify({active:j.active!==false?false:true})});await load();}
      catch(e){toast(e.message,true)}
    }));
  }

  function openImportModal(){
    modalCard.innerHTML=`
      <h2>Import / Sync Jobs</h2>
      <div class="row"><div><label>Mode</label>
        <select id="im-mode"><option value="paste">Paste one per line</option><option value="csv">CSV</option></select></div></div>
      <p class="hint" id="im-hint">One job per line: <code>Title | Location | Type | Department | Summary | URL</code></p>
      <textarea id="im-text" rows="10" placeholder="Paste your job lines or CSV here, or choose a CSV file…"></textarea>
      <input type="file" id="im-file" accept=".csv,text/csv">
      <div class="actions">
        <button class="btn" id="im-cancel">Cancel</button>
        <button class="btn primary" id="im-run">Import</button>
      </div>
      <p class="status" id="im-status"></p>`;
    modal.classList.add('open');
    const hint=document.getElementById('im-hint');
    document.getElementById('im-mode').addEventListener('change',e=>{
      hint.innerHTML=e.target.value==='csv'
        ?'CSV columns: <code>title,location,type,department,posted,summary,url</code> (header row required)'
        :'One job per line: <code>Title | Location | Type | Department | Summary | URL</code>';
    });
    document.getElementById('im-file').addEventListener('change',e=>{
      const f=e.target.files[0];if(!f)return;
      const rd=new FileReader();
      rd.onload=()=>{document.getElementById('im-text').value=rd.result;document.getElementById('im-mode').value='csv';hint.innerHTML='CSV columns: <code>title,location,type,department,posted,summary,url</code> (header row required)';};
      rd.readAsText(f);
    });
    document.getElementById('im-cancel').addEventListener('click',()=>modal.classList.remove('open'));
    document.getElementById('im-run').addEventListener('click',async()=>{
      const st=document.getElementById('im-status');st.className='status';st.textContent='Importing…';
      const mode=document.getElementById('im-mode').value;
      const text=document.getElementById('im-text').value.trim();
      if(!text){st.className='status err';st.textContent='Paste job data first.';return}
      try{
        const res=await api('/api/admin/sync/import',{method:'POST',body:JSON.stringify({mode,text})});
        st.className='status ok';st.textContent=res.data.message;
        setTimeout(()=>{modal.classList.remove('open');load()},900);
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  const CONTENT_GROUPS=[
    {title:'Navigation',keys:[['nav.home','Home'],['nav.about','About'],['nav.services','Services'],['nav.careers','Careers'],['nav.jobs','Jobs'],['nav.contact','Contact']]},
    {title:'Header CTA',keys:[['cta.label','Button label'],['cta.href','Button link']]},
    {title:'Home hero',keys:[['hero.eyebrow','Eyebrow'],['hero.title','Headline'],['hero.subtitle','Subtitle'],['hero.primary','Primary CTA label'],['hero.secondary','Secondary CTA label']]},
    {title:'Footer',keys:[['footer.tagline','Tagline'],['footer.email','Email'],['footer.phone','Phone'],['footer.name','Company name']]}
  ];
  function val(c,key){const [g,k]=key.split('.');return (c[g]&&c[g][k])||''}
  function renderContent(){
    const c=state.data||{};
    view.innerHTML=`
      <div class="toolbar"><button class="btn primary" id="ct-save">Save &amp; Apply</button><a class="btn" href="/" target="_blank">View Site</a></div>
      <p class="empty" style="text-align:left;margin:0 0 12px">Edits update shared regions across all pages (header navigation, footer, home hero) by rewriting each page's header/footer from the stored content file. Leave a field unchanged to keep the current text.</p>
      ${CONTENT_GROUPS.map(g=>`<div class="panel"><h3 style="margin-top:0">${g.title}</h3>${g.keys.map(([key,label])=>`<label>${label}</label><input type="text" id="ct-${key.replace('.','-')}" value="${esc(val(c,key))}">`).join('')}</div>`).join('')}
      <p class="status" id="ct-status"></p>`;
    document.getElementById('ct-save').addEventListener('click',async()=>{
      const st=document.getElementById('ct-status');st.className='status';st.textContent='Saving…';
      const content={nav:{},cta:{},hero:{},footer:{}};
      for(const g of CONTENT_GROUPS){for(const [key] of g.keys){const [grp,k]=key.split('.');content[grp][k]=document.getElementById(`ct-${key.replace('.','-')}`).value.trim()}}
      try{
        const res=await api('/api/admin/content',{method:'POST',body:JSON.stringify({content})});
        st.className='status ok';st.textContent=res.message||'Saved.';
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  function renderPages(){
    const pages=(state.data&&state.data.pages)||[];
    if(!pages.length){view.innerHTML='<p class="empty">No editable pages.</p>';return}
    const page=pages.find(p=>p.file===state.pageFile)||pages[0];
    state.pageFile=page.file;
    const groups=[];
    for(const f of page.fields){
      let g=groups[groups.length-1];
      if(!g||g.name!==f.group){g={name:f.group,items:[]};groups.push(g)}
      g.items.push(f);
    }
    view.innerHTML=`
      <div class="toolbar">
        <label style="font-weight:600;color:var(--muted)">Page</label>
        <select id="pg-pick">${pages.map(p=>`<option value="${esc(p.file)}"${p.file===page.file?' selected':''}>${esc(p.label)}</option>`).join('')}</select>
        <button class="btn primary" id="pg-save">Save &amp; Apply</button>
        <button class="btn" id="pg-reset">Reset Page</button>
        <a class="btn" href="/${page.file==='index.html'?'':page.file}" target="_blank">View Page</a>
      </div>
      <p class="empty" style="text-align:left;margin:0 0 12px">Edit the visible text on this page — eyebrows, headings, intros, and button labels. Clear a field and save to restore its original text. Layout, links, and images are unchanged.</p>
      ${groups.map(g=>`<div class="panel"><h3 style="margin-top:0">${esc(g.name)}</h3>${g.items.map(f=>`<label>${esc(f.label)}</label><input type="text" data-key="${esc(f.key)}" value="${esc(f.value)}">`).join('')}</div>`).join('')}
      <p class="status" id="pg-status"></p>`;
    document.getElementById('pg-pick').addEventListener('change',e=>{state.pageFile=e.target.value;renderPages()});
    document.getElementById('pg-save').addEventListener('click',()=>savePages(page.file,false));
    document.getElementById('pg-reset').addEventListener('click',()=>{if(confirm('Restore this page to its original text?'))savePages(page.file,true)});
  }

  async function savePages(file,reset){
    const st=document.getElementById('pg-status');
    st.className='status';st.textContent=reset?'Restoring…':'Saving…';
    const values={};
    if(!reset)view.querySelectorAll('[data-key]').forEach(i=>{values[i.dataset.key]=i.value});
    try{
      const res=await api('/api/admin/pages',{method:'POST',body:JSON.stringify({file,values})});
      const pages=(state.data&&state.data.pages)||[];
      const pg=pages.find(p=>p.file===file);
      if(pg&&res.data&&res.data.fields)pg.fields=res.data.fields;
      renderPages();
      toast(res.message||'Saved.');
    }catch(e){st.className='status err';st.textContent=e.message}
  }

  function openReplyModal(kind,rec){
    modalCard.innerHTML=`
      <h2>Reply to ${esc(rec.name||rec.company||'sender')}</h2>
      <label>To</label><input id="rp-to" type="email" value="${esc(rec.email)}">
      <label>Subject</label><input id="rp-subject" type="text" value="Re: ${esc(rec.jobTitle||rec.topic||rec.service||'your submission')}">
      <label>Message</label><textarea id="rp-body" rows="6"></textarea>
      <div class="actions">
        <button class="btn" id="rp-cancel">Cancel</button>
        <button class="btn primary" id="rp-send">Send</button>
      </div>
      <p class="status" id="rp-status"></p>`;
    modal.classList.add('open');
    document.getElementById('rp-cancel').addEventListener('click',()=>modal.classList.remove('open'));
    document.getElementById('rp-send').addEventListener('click',async()=>{
      const st=document.getElementById('rp-status');
      const body={to:document.getElementById('rp-to').value.trim(),subject:document.getElementById('rp-subject').value.trim(),body:document.getElementById('rp-body').value.trim()};
      if(!body.to||!body.subject||!body.body){st.className='status err';st.textContent='All fields are required.';return}
      try{
        const res=await api(`/api/admin/${kind}/${encodeURIComponent(rec.id)}/reply`,{method:'POST',body:JSON.stringify(body)});
        st.className='status ok';st.textContent=res.message||'Reply sent.';
        setTimeout(()=>{modal.classList.remove('open');load()},800);
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  view.addEventListener('click',async(e)=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const panel=btn.closest('.panel');const idx=[...view.querySelectorAll('.panel')].indexOf(panel);
    const rec=filterRows()[idx];
    if(btn.dataset.action==='reply')return openReplyModal(state.tab,rec);
    if(btn.dataset.action==='read'){
      try{await api(`/api/admin/${state.tab}/${encodeURIComponent(rec.id)}/read`,{method:'POST',body:JSON.stringify({read:!rec.read})});await load();}
      catch(e){alert(e.message)}
    }
  });

  renderTabs();load();
})();
