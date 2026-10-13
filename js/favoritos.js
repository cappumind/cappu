(function () {
  const grid = document.getElementById('favoritesGrid');
  const notice = document.getElementById('favoritesNotice');
  const empty = document.getElementById('favoritesEmpty');
  let currentUser = null;
  let unsubscribe = null;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function showEmpty(show) { empty.hidden = !show; }
  function render(snapshot) {
    grid.innerHTML = '';
    if (snapshot.empty) { showEmpty(true); return; }
    showEmpty(false);
    snapshot.forEach(doc => {
      const item = doc.data();
      const card = document.createElement('article');
      card.className = 'story-tile';
      card.innerHTML = `<div class="tile-cover ${coverClass(item.genero)}"><span>☕</span></div><div class="tile-body"><span class="tile-tag">${escapeHtml(item.genero || 'História')}</span><h3>${escapeHtml(item.titulo || 'História sem título')}</h3><p>${escapeHtml(item.sinopse || 'Uma história esperando por você.')}</p><small>Por ${escapeHtml(item.autorNome || 'Leitor Cappu')}</small><div class="tile-actions"><button class="cappu-btn" data-read="${escapeHtml(item.storyId || doc.id)}">Ler história</button><button class="icon-action" data-remove="${doc.id}" aria-label="Remover dos favoritos" title="Remover dos favoritos">♥</button></div></div>`;
      grid.appendChild(card);
    });
  }
  function coverClass(genre = '') {
    const g = genre.toLowerCase();
    if (g.includes('fantasia')) return 'cover-fantasy';
    if (g.includes('mistério') || g.includes('suspense')) return 'cover-mystery';
    if (g.includes('romance')) return 'cover-romance';
    return 'cover-default';
  }
  document.addEventListener('cappu:auth', event => {
    currentUser = event.detail.user;
    if (unsubscribe) unsubscribe();
    grid.innerHTML = '';
    if (!currentUser) {
      notice.hidden = false;
      notice.textContent = 'Entre na sua conta para acessar seus favoritos.';
      showEmpty(false);
      return;
    }
    notice.hidden = true;
    unsubscribe = db.collection('Leitores').doc(currentUser.uid).collection('favoritos').orderBy('salvoEm', 'desc').onSnapshot(render, error => {
      console.error(error); notice.hidden = false; notice.textContent = 'Não foi possível carregar os favoritos. Confira as regras do Firestore.';
    });
  });
  grid.addEventListener('click', async event => {
    const remove = event.target.closest('[data-remove]');
    const read = event.target.closest('[data-read]');
    if (remove && currentUser) {
      try { await db.collection('Leitores').doc(currentUser.uid).collection('favoritos').doc(remove.dataset.remove).delete(); }
      catch (error) { alert(CappuAuth.friendlyError(error)); }
    }
    if (read) {
      const id = read.dataset.read;
      window.location.href = `ler.html?id=${encodeURIComponent(id)}`;
    }
  });

})();
