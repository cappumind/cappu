(function () {
  const workspace = document.getElementById('writingWorkspace');
  const loginHint = document.getElementById('writingLoginHint');
  const form = document.getElementById('storyForm');
  const title = document.getElementById('storyTitle');
  const genre = document.getElementById('storyGenre');
  const author = document.getElementById('storyAuthor');
  const synopsis = document.getElementById('storySynopsis');
  const content = document.getElementById('storyContent');
  const message = document.getElementById('storyMessage');
  const status = document.getElementById('storyStatus');
  const list = document.getElementById('myStoriesList');
  const saveButton = document.getElementById('saveDraftButton');
  const publishButton = document.getElementById('publishStoryButton');
  let currentUser = null;
  let activeStoryId = new URLSearchParams(location.search).get('id');
  let activeStatus = 'rascunho';
  let busy = false;
  let unsubscribe = null;

  function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function updateCounters() {
    document.getElementById('synopsisCount').textContent = synopsis.value.length;
    document.getElementById('contentCount').textContent = content.value.length;
  }
  function updateStatus(value) { activeStatus = value; status.textContent = value === 'publicada' ? 'Publicada' : 'Rascunho'; status.classList.toggle('is-published', value === 'publicada'); }
  function showMessage(text, error = false) { message.textContent = text; message.classList.toggle('is-error', error); }
  [synopsis, content].forEach(el => el.addEventListener('input', updateCounters));
  function loadStory(id) {
    if (!currentUser || !id) return;
    db.collection('historias').doc(id).get().then(async doc => {
      if (!doc.exists || doc.data().autorUid !== currentUser.uid) { showMessage('Não encontramos essa história na sua conta.', true); activeStoryId = null; return; }
      const data = doc.data();
      title.value = data.titulo || ''; genre.value = data.genero || ''; author.value = data.autorNome || '';
      synopsis.value = data.sinopse || ''; updateStatus(data.status || 'rascunho');
      const contentDoc = await db.collection('historias').doc(id).collection('conteudo').doc('full').get();
      content.value = contentDoc.exists ? (contentDoc.data().texto || '') : '';
      updateCounters(); showMessage('História carregada para edição.');
    }).catch(error => showMessage(window.CappuAuth?.friendlyError(error) || error.message, true));
  }
  async function saveStory(publish) {
    if (!currentUser) { window.CappuAuth?.open(); return; }
    if (busy) return;
    if (!title.value.trim() || !genre.value || !synopsis.value.trim() || !content.value.trim()) {
      showMessage('Preencha título, gênero, sinopse e texto da história antes de salvar ou publicar.', true); return;
    }
    busy = true; saveButton.disabled = publishButton.disabled = true;
    showMessage(publish ? 'Publicando sua história...' : 'Salvando rascunho...');
    const ref = activeStoryId ? db.collection('historias').doc(activeStoryId) : db.collection('historias').doc();
    try {
      const oldDoc = activeStoryId ? await ref.get() : null;
      if (oldDoc && oldDoc.exists && oldDoc.data().autorUid !== currentUser.uid) {
        throw new Error('Você não tem permissão para editar esta história.');
      }
      const previousCreatedAt = oldDoc && oldDoc.exists && oldDoc.data().criadoEm ? oldDoc.data().criadoEm : firebase.firestore.FieldValue.serverTimestamp();
      const metadata = {
        titulo: title.value.trim(), genero: genre.value,
        autorNome: author.value.trim() || currentUser.displayName || currentUser.email.split('@')[0],
        sinopse: synopsis.value.trim(), autorUid: currentUser.uid,
        status: publish ? 'publicada' : 'rascunho',
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        criadoEm: previousCreatedAt
      };
      await ref.set(metadata, { merge: true });
      await ref.collection('conteudo').doc('full').set({ texto: content.value, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      activeStoryId = ref.id; updateStatus(metadata.status);
      const url = new URL(location.href); url.searchParams.set('id', activeStoryId); history.replaceState({}, '', url);
      showMessage(publish ? 'História publicada! Visitantes já podem ver a sinopse; o texto completo exige login.' : 'Rascunho salvo com sucesso. Você pode voltar e continuar quando quiser.');
      loadMyStories();
    } catch (error) { console.error(error); showMessage(window.CappuAuth?.friendlyError(error) || 'Não foi possível salvar a história.', true); }
    finally { busy = false; saveButton.disabled = publishButton.disabled = false; }
  }
  saveButton.addEventListener('click', () => saveStory(false));
  publishButton.addEventListener('click', () => saveStory(true));
  form.addEventListener('submit', event => event.preventDefault());
  document.getElementById('newStoryButton').addEventListener('click', () => {
    activeStoryId = null; title.value = ''; genre.value = ''; author.value = ''; synopsis.value = ''; content.value = ''; updateCounters(); updateStatus('rascunho'); showMessage('Nova história pronta para começar.');
    const url = new URL(location.href); url.searchParams.delete('id'); history.replaceState({}, '', url); title.focus();
  });
  async function loadMyStories() {
    if (!currentUser) return;
    try {
      const snap = await db.collection('historias').where('autorUid', '==', currentUser.uid).get();
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => {
        const ta = a.atualizadoEm && a.atualizadoEm.toMillis ? a.atualizadoEm.toMillis() : 0;
        const tb = b.atualizadoEm && b.atualizadoEm.toMillis ? b.atualizadoEm.toMillis() : 0;
        return tb - ta;
      });
      list.innerHTML = '';
      if (!docs.length) { list.innerHTML = '<p class="muted-copy">Suas histórias aparecerão aqui. Comece pela primeira!</p>'; return; }
      docs.forEach(item => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'my-story-item' + (item.id === activeStoryId ? ' active' : '');
        button.innerHTML = `<span class="my-story-icon">${item.status === 'publicada' ? '📖' : '📝'}</span><span class="my-story-copy"><strong>${esc(item.titulo || 'Sem título')}</strong><small>${item.status === 'publicada' ? 'Publicada' : 'Rascunho'} · ${esc(item.genero || 'Sem gênero')}</small></span><span>›</span>`;
        button.addEventListener('click', () => { activeStoryId = item.id; loadStory(item.id); }); list.appendChild(button);
      });
    } catch (error) { console.error(error); list.innerHTML = `<p class="muted-copy">${esc(window.CappuAuth?.friendlyError(error) || 'Não foi possível carregar suas histórias.')}</p>`; }
  }
  document.addEventListener('cappu:auth', event => {
    currentUser = event.detail.user;
    workspace.hidden = !currentUser; loginHint.hidden = !!currentUser;
    if (!currentUser) { if (unsubscribe) unsubscribe(); return; }
    loadMyStories();
    if (activeStoryId) loadStory(activeStoryId);
  });
})();
