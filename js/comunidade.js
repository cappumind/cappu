(function () {
  const form = document.getElementById('ideaForm');
  const text = document.getElementById('ideaText');
  const count = document.getElementById('ideaCount');
  const message = document.getElementById('ideaMessage');
  const feed = document.getElementById('communityFeed');
  const empty = document.getElementById('communityEmpty');
  const hint = document.getElementById('communityLoginHint');
  const filter = document.getElementById('ideaFilter');
  let currentUser = null;
  let ideas = [];
  let unsubscribe = null;

  function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function render() {
    const selected = filter.value;
    const visible = ideas.filter(idea => selected === 'Todas' || idea.tipo === selected);
    feed.innerHTML = '';
    empty.hidden = visible.length > 0;
    visible.forEach(idea => {
      const article = document.createElement('article');
      article.className = 'idea-card';
      const date = idea.criadoEm && idea.criadoEm.toDate ? idea.criadoEm.toDate().toLocaleDateString('pt-BR') : 'Agora há pouco';
      article.innerHTML = `<div class="idea-card-top"><span class="tile-tag">${esc(idea.tipo || 'Ideia')}</span><time>${esc(date)}</time></div><p class="idea-content">${esc(idea.texto || '').replace(/\n/g, '<br>')}</p><div class="idea-author"><span class="mini-avatar">${esc((idea.autorNome || 'L').charAt(0).toUpperCase())}</span><span>Compartilhado por <strong>${esc(idea.autorNome || 'Leitor Cappu')}</strong></span>${currentUser && idea.autorUid === currentUser.uid ? `<button class="delete-idea" type="button" data-delete="${idea.id}">Excluir</button>` : ''}</div>`;
      feed.appendChild(article);
    });
  }
  text.addEventListener('input', () => { count.textContent = text.value.length; });
  filter.addEventListener('change', render);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser) { window.CappuAuth?.open(); hint.hidden = false; return; }
    const body = text.value.trim();
    if (!body) { message.textContent = 'Escreva sua ideia antes de compartilhar.'; return; }
    const button = form.querySelector('[type="submit"]'); button.disabled = true; message.textContent = 'Compartilhando sua ideia...';
    try {
      await db.collection('comunidade').add({
        tipo: document.getElementById('ideaType').value,
        texto: body,
        autorUid: currentUser.uid,
        autorNome: currentUser.displayName || currentUser.email.split('@')[0],
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      form.reset(); count.textContent = '0'; message.textContent = 'Sua ideia foi compartilhada. Obrigado por inspirar a comunidade! ✨';
    } catch (error) { console.error(error); message.textContent = window.CappuAuth?.friendlyError(error) || 'Não foi possível publicar a ideia.'; }
    finally { button.disabled = false; }
  });
  feed.addEventListener('click', async event => {
    const button = event.target.closest('[data-delete]');
    if (!button || !currentUser) return;
    if (!confirm('Deseja excluir esta publicação?')) return;
    try { await db.collection('comunidade').doc(button.dataset.delete).delete(); }
    catch (error) { alert(window.CappuAuth?.friendlyError(error) || 'Não foi possível excluir.'); }
  });
  document.addEventListener('cappu:auth', event => {
    currentUser = event.detail.user;
    hint.hidden = !!currentUser;
    if (unsubscribe) unsubscribe();
    unsubscribe = db.collection('comunidade').orderBy('criadoEm', 'desc').limit(100).onSnapshot(snapshot => {
      ideas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); render();
    }, error => { console.error(error); feed.innerHTML = '<p class="notice">Não foi possível carregar a comunidade. Confira as regras do Firestore.</p>'; });
  });
})();
