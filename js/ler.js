(function () {
  const params = new URLSearchParams(location.search);
  const storyId = params.get('id');
  const notice = document.getElementById('readingNotice');
  const article = document.getElementById('storyReading');
  const section = document.getElementById('publishedSection');
  const grid = document.getElementById('publishedGrid');
  const empty = document.getElementById('publishedEmpty');
  let currentUser = null;
  let currentStory = null;
  let fullTextLoaded = false;
  function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function coverClass(genre='') { const g=genre.toLowerCase(); return g.includes('fantasia')?'cover-fantasy':(g.includes('mistério')||g.includes('suspense'))?'cover-mystery':g.includes('romance')?'cover-romance':'cover-default'; }
  function card(item) {
    const node = document.createElement('article'); node.className='story-tile';
    node.innerHTML=`<div class="tile-cover ${coverClass(item.genero)}"><span>📖</span></div><div class="tile-body"><span class="tile-tag">${esc(item.genero||'História')}</span><h3>${esc(item.titulo||'História sem título')}</h3><p>${esc(item.sinopse||'Uma nova história para descobrir.')}</p><small>Por ${esc(item.autorNome||'Leitor Cappu')}</small><div class="tile-actions"><a class="cappu-btn" href="ler.html?id=${encodeURIComponent(item.id)}">Ler prévia</a></div></div>`;
    return node;
  }
  function showPreview(item) {
    currentStory=item; article.hidden=false; section.hidden=true;
    document.getElementById('readGenre').textContent=item.genero||'História';
    document.getElementById('readTitle').textContent=item.titulo||'História sem título';
    document.getElementById('readByline').textContent='Por '+(item.autorNome||'Leitor Cappu');
    document.getElementById('readSynopsis').innerHTML='<strong>Sinopse</strong><p>'+esc(item.sinopse||'')+'</p>';
    document.getElementById('readContent').innerHTML='';
    document.getElementById('readLocked').hidden=!!currentUser;
    document.getElementById('readFavorite').hidden=!currentUser;
    if (currentUser) loadFullText();
  }
  async function loadFullText() {
    if (!currentUser || !currentStory || fullTextLoaded) return;
    try {
      const doc=await db.collection('historias').doc(currentStory.id).collection('conteudo').doc('full').get();
      if (!doc.exists) { notice.hidden=false; notice.textContent='O texto completo ainda não está disponível.'; return; }
      document.getElementById('readContent').textContent=doc.data().texto||'';
      document.getElementById('readContent').classList.add('has-content');
      document.getElementById('readLocked').hidden=true; fullTextLoaded=true;
    } catch(error) { console.error(error); notice.hidden=false; notice.textContent=window.CappuAuth?.friendlyError(error)||'Não foi possível carregar o texto completo.'; }
  }
  async function loadPublished() {
    try {
      const snap=await db.collection('historias').where('status','==','publicada').get();
      const docs=snap.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>{const ta=a.atualizadoEm?.toMillis?a.atualizadoEm.toMillis():0;const tb=b.atualizadoEm?.toMillis?b.atualizadoEm.toMillis():0;return tb-ta;});
      grid.innerHTML=''; docs.forEach(item=>grid.appendChild(card(item))); empty.hidden=docs.length>0;
      if (storyId) { const found=docs.find(item=>item.id===storyId); if(found) showPreview(found); else {notice.hidden=false;notice.textContent='Esta história não existe ou ainda não foi publicada.';} }
    } catch(error) { console.error(error); notice.hidden=false; notice.textContent='Não foi possível carregar as histórias. Confira as regras do Firestore.'; }
  }
  document.addEventListener('cappu:auth', event => {
    const nextUser=event.detail.user;
    const changed=(!currentUser && nextUser)||(currentUser && !nextUser)||(currentUser&&nextUser&&currentUser.uid!==nextUser.uid);
    currentUser=nextUser;
    if (currentStory && changed) { fullTextLoaded=false; showPreview(currentStory); }
    document.getElementById('readFavorite').hidden=!currentUser||!currentStory;
  });
  document.getElementById('readFavorite').addEventListener('click', async () => {
    if (!currentUser || !currentStory) return;
    try {
      const saved=await window.CappuFavorites.toggle(currentStory.id,currentStory);
      document.getElementById('readFavorite').textContent=saved?'♥ Salvo nos favoritos':'♡ Salvar nos favoritos';
    } catch(error) { alert(window.CappuAuth?.friendlyError(error)||'Não foi possível salvar nos favoritos.'); }
  });
  loadPublished();
})();
