/* Perfil do leitor: exibe apenas os dados e histórias da conta autenticada. */
(function () {
  const nomeElement = document.getElementById('perfilNome');
  const emailElement = document.getElementById('perfilEmail');
  const storiesElement = document.getElementById('minhasHistorias');
  const emptyElement = document.getElementById('semHistorias');
  const storyCount = document.getElementById('totalHistorias');
  const favoriteCount = document.getElementById('totalFavoritos');

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

  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.replace('index.html'); return; }
    if (emailElement) emailElement.textContent = user.email || 'E-mail não informado';
    try {
      const profileDoc = await db.collection('Leitores').doc(user.uid).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      const displayName = profile.nome || user.displayName || 'leitor';
      if (nomeElement) nomeElement.textContent = `Olá, ${displayName}! ☕`;

      const [storiesSnap, favoritesSnap] = await Promise.all([
        db.collection('historias').where('autorUid', '==', user.uid).get(),
        db.collection('Leitores').doc(user.uid).collection('favoritos').get()
      ]);
      const stories = storiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.atualizadoEm?.toMillis?.() || 0) - (a.atualizadoEm?.toMillis?.() || 0));
      if (storyCount) storyCount.textContent = stories.filter(story => story.status === 'publicada').length;
      if (favoriteCount) favoriteCount.textContent = favoritesSnap.size;
      if (storiesElement) {
        storiesElement.innerHTML = '';
        stories.forEach(story => {
          const card = document.createElement('article');
          card.className = 'story-card';
          card.innerHTML = `<div class="story-cover ${coverClass(story.genero)}"><span>♥</span></div><div class="story-info"><span>${esc(story.genero || 'História')} · ${story.status === 'publicada' ? 'Publicada' : 'Rascunho'}</span><h3>${esc(story.titulo || 'História sem título')}</h3><p>${esc(story.sinopse || '')}</p><a class="cappu-btn" href="publicar.html?id=${encodeURIComponent(story.id)}">${story.status === 'publicada' ? 'Editar história' : 'Continuar escrevendo'}</a></div>`;
          storiesElement.appendChild(card);
        });
      }
      if (emptyElement) emptyElement.classList.toggle('d-none', stories.length > 0);
    } catch (error) {
      console.error('Erro ao carregar o perfil:', error);
      if (storiesElement) storiesElement.innerHTML = '<p class="text-muted">Não foi possível carregar seu perfil. Confira as regras do Firestore.</p>';
    }
  });
})();
