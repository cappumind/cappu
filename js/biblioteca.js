/* Biblioteca pessoal: os favoritos vêm do Firestore; não exibimos dados fictícios. */
(function () {
  const grid = document.getElementById('libraryFavorites');
  const empty = document.getElementById('libraryFavoritesEmpty');
  const message = document.getElementById('libraryFavoritesMessage');
  if (!grid || !empty) return;
  let unsubscribe = null;
  let currentUser = null;

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function coverClass(genre = '') {
    const g = String(genre).toLocaleLowerCase('pt-BR');
    if (g.includes('fantasia')) return 'fantasy-cover';
    if (g.includes('mistério') || g.includes('misterio') || g.includes('suspense')) return 'mystery-cover';
    if (g.includes('drama')) return 'drama-cover';
    return 'romance-cover';
  }
  function render(snapshot) {
    grid.innerHTML = '';
    empty.classList.toggle('d-none', !snapshot.empty);
    if (snapshot.empty) return;
    snapshot.forEach(doc => {
      const story = doc.data();
      const id = story.storyId || doc.id;
      const card = document.createElement('article');
      card.className = 'library-story-card';
      card.innerHTML = `<div class="story-mini-cover ${coverClass(story.genero)}"><span>♥</span></div><div><span>${esc(story.genero || 'História')}</span><h3>${esc(story.titulo || 'História sem título')}</h3><p>Por ${esc(story.autorNome || 'Leitor Cappu')}</p><a href="ler.html?id=${encodeURIComponent(id)}">Ler história →</a></div><button class="remove-save" type="button" data-remove-favorite="${esc(doc.id)}" aria-label="Remover dos favoritos">♥</button>`;
      grid.appendChild(card);
    });
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-remove-favorite]');
    if (!button || !currentUser) return;
    try {
      await db.collection('Leitores').doc(currentUser.uid).collection('favoritos').doc(button.dataset.removeFavorite).delete();
    } catch (error) {
      console.error(error);
      if (message) message.textContent = window.CappuAuth?.friendlyError(error) || 'Não foi possível remover o favorito.';
    }
  });
  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    grid.innerHTML = '';
    if (!user) {
      empty.classList.remove('d-none');
      if (message) message.textContent = 'Entre para carregar seus favoritos pessoais.';
      return;
    }
    if (message) message.textContent = '';
    unsubscribe = db.collection('Leitores').doc(user.uid).collection('favoritos').orderBy('salvoEm', 'desc').onSnapshot(render, error => {
      console.error(error);
      if (message) message.textContent = window.CappuAuth?.friendlyError(error) || 'Não foi possível carregar seus favoritos.';
    });
  });
})();
