/* CappuMind: autenticação compartilhada das páginas antigas + catálogo de histórias. */
let usuarioAtual = null;
let historiasOriginais = [];
let authReady = false;

function abrirLogin() {
  const modalElement = document.getElementById('loginModal');
  if (!modalElement || !window.bootstrap) return;
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function mensagemAuth(error) {
  const code = error?.code;
  const messages = {
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado. Entre na sua conta.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'permission-denied': 'O Firebase recusou a operação. Confira as regras do Firestore.'
  };
  return messages[code] || 'Não foi possível concluir. Verifique os dados e tente novamente.';
}

async function garantirPerfilLeitor(user, nome = '') {
  if (!user) return;
  const ref = db.collection('Leitores').doc(user.uid);
  const doc = await ref.get();
  if (!doc.exists) {
    const dados = {
      email: user.email || '',
      perfil: 'cliente',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    const nomeFinal = nome.trim() || user.displayName || '';
    if (nomeFinal) dados.nome = nomeFinal;
    await ref.set(dados, { merge: true });
  }
}

async function login() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('senha');
  const email = emailInput?.value.trim() || '';
  const senha = passwordInput?.value || '';
  if (!email || !senha) return alert('Preencha o e-mail e a senha.');
  try {
    const credential = await auth.signInWithEmailAndPassword(email, senha);
    await garantirPerfilLeitor(credential.user);
    const modal = document.getElementById('loginModal');
    if (modal && window.bootstrap) bootstrap.Modal.getInstance(modal)?.hide();
  } catch (error) {
    console.error('Erro no login:', error);
    alert(mensagemAuth(error));
  }
}

async function cadastrar() {
  const email = document.getElementById('emailCadastro')?.value.trim() || '';
  const senha = document.getElementById('senhaCadastro')?.value || '';
  const nome = document.getElementById('nomeCadastro')?.value.trim() || '';
  if (!email || !senha) return alert('Preencha o e-mail e a senha.');
  if (senha.length < 6) return alert('A senha precisa ter pelo menos 6 caracteres.');
  try {
    const credential = await auth.createUserWithEmailAndPassword(email, senha);
    if (nome) await credential.user.updateProfile({ displayName: nome });
    await db.collection('Leitores').doc(credential.user.uid).set({
      email,
      ...(nome ? { nome } : {}),
      perfil: 'cliente',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    const modal = document.getElementById('loginModal');
    if (modal && window.bootstrap) bootstrap.Modal.getInstance(modal)?.hide();
    alert('Cadastro realizado com sucesso! Bem-vindo ao CappuMind. ☕');
  } catch (error) {
    console.error('Erro no cadastro:', error);
    alert(mensagemAuth(error) + (auth.currentUser ? '\nSe a conta foi criada, saia e entre novamente para sincronizar o perfil.' : ''));
  }
}

async function recuperarSenha() {
  const email = document.getElementById('email')?.value.trim() || document.getElementById('emailCadastro')?.value.trim() || '';
  if (!email) return alert('Digite seu e-mail no campo de entrada antes de solicitar a recuperação.');
  try {
    await auth.sendPasswordResetEmail(email);
    alert('Se houver uma conta com esse e-mail, você receberá as instruções para redefinir a senha.');
  } catch (error) {
    console.error('Erro ao recuperar senha:', error);
    alert(mensagemAuth(error));
  }
}

function logout() {
  auth.signOut().then(() => { window.location.href = 'index.html'; })
    .catch(error => { console.error(error); alert('Não foi possível sair da conta. Tente novamente.'); });
}

function classeCapa(genero = '') {
  const g = String(genero).toLocaleLowerCase('pt-BR');
  if (g.includes('fantasia')) return 'fantasy-cover';
  if (g.includes('mistério') || g.includes('misterio') || g.includes('suspense')) return 'mystery-cover';
  if (g.includes('romance')) return 'romance-cover';
  if (g.includes('drama')) return 'drama-cover';
  if (g.includes('aventura')) return 'adventure-cover';
  return 'romance-cover';
}

function escaparHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function carregarProdutos() {
  // Nome preservado para compatibilidade com o HTML antigo; agora carrega histórias publicadas.
  const container = document.getElementById('produtos');
  if (!container) return;
  container.innerHTML = '<p class="muted-copy">Carregando histórias... ☕</p>';
  db.collection('historias').where('status', '==', 'publicada').get()
    .then(snapshot => {
      historiasOriginais = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      historiasOriginais.sort((a, b) => {
        const ta = a.atualizadoEm?.toMillis ? a.atualizadoEm.toMillis() : 0;
        const tb = b.atualizadoEm?.toMillis ? b.atualizadoEm.toMillis() : 0;
        return tb - ta;
      });
      renderizarDestaques();
      renderizarProdutos(aplicarFiltroHistorias());
    })
    .catch(error => {
      console.error('Erro ao carregar histórias:', error);
      container.innerHTML = '<p class="muted-copy">Não foi possível carregar as histórias. Confira a conexão e as regras do Firestore.</p>';
    });
}


function renderizarDestaques() {
  const stories = historiasOriginais;
  const featured = document.getElementById('featuredStories');
  if (featured) {
    featured.innerHTML = '';
    stories.slice(0, 2).forEach(story => {
      const card = document.createElement('article');
      card.className = 'featured-card';
      const cover = classeCapa(story.genero).replace('-cover', '');
      card.innerHTML = `<div class="cover ${cover}"></div><div class="featured-info"><span>${escaparHTML(story.genero || 'História')}</span><h3>${escaparHTML(story.titulo || 'História sem título')}</h3><p>Por ${escaparHTML(story.autorNome || 'Leitor Cappu')}</p><a class="cappu-btn" href="ler.html?id=${encodeURIComponent(story.id)}">Ler prévia</a></div><button class="save" type="button" data-favorite="${escaparHTML(story.id)}" aria-label="Salvar nos favoritos">♡</button>`;
      featured.appendChild(card);
    });
    if (!stories.length) featured.innerHTML = '<p class="muted-copy">As histórias publicadas aparecerão aqui. Que tal escrever a primeira?</p>';
  }
  const popular = document.getElementById('popularStories');
  if (popular) {
    popular.innerHTML = '';
    stories.slice(0, 4).forEach(story => {
      const card = document.createElement('article');
      card.className = 'story-card';
      card.innerHTML = `<div class="story-cover ${classeCapa(story.genero)}"><span>♥</span></div><div class="story-info"><span>${escaparHTML(story.genero || 'História')}</span><h3>${escaparHTML(story.titulo || 'História sem título')}</h3><p>Por ${escaparHTML(story.autorNome || 'Leitor Cappu')}</p><a class="cappu-btn" href="ler.html?id=${encodeURIComponent(story.id)}">Ler prévia</a></div><button class="save" type="button" data-favorite="${escaparHTML(story.id)}" aria-label="Salvar nos favoritos">♡</button>`;
      popular.appendChild(card);
    });
    if (!stories.length) popular.innerHTML = '<p class="muted-copy">Ainda não há histórias publicadas. Volte em breve!</p>';
  }
}

function aplicarFiltroHistorias() {
  const query = (document.getElementById('busca')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const genero = (document.getElementById('precoMin')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const autor = (document.getElementById('precoMax')?.value || '').trim().toLocaleLowerCase('pt-BR');
  return historiasOriginais.filter(story => {
    const searchable = [story.titulo, story.sinopse, story.genero, story.autorNome].join(' ').toLocaleLowerCase('pt-BR');
    return (!query || searchable.includes(query))
      && (!genero || String(story.genero || '').toLocaleLowerCase('pt-BR').includes(genero))
      && (!autor || String(story.autorNome || '').toLocaleLowerCase('pt-BR').includes(autor));
  });
}

function aplicarFiltros() { renderizarProdutos(aplicarFiltroHistorias()); }

function renderizarProdutos(lista) {
  const container = document.getElementById('produtos');
  if (!container) return;
  container.innerHTML = '';
  const empty = document.getElementById('emptyStories');
  if (empty) empty.classList.toggle('d-none', lista.length > 0);
  lista.forEach(story => {
    const card = document.createElement('article');
    card.className = 'story-card';
    card.innerHTML = `
      <div class="story-cover ${classeCapa(story.genero)}"><span>♥</span></div>
      <div class="story-info">
        <span>${escaparHTML(story.genero || 'História')}</span>
        <h3>${escaparHTML(story.titulo || 'História sem título')}</h3>
        <p>Por ${escaparHTML(story.autorNome || 'Leitor Cappu')}</p>
        <p class="story-synopsis">${escaparHTML(story.sinopse || '')}</p>
        <a class="cappu-btn" href="ler.html?id=${encodeURIComponent(story.id)}">Ler prévia</a>
      </div>
      <button class="save" type="button" data-favorite="${escaparHTML(story.id)}" aria-label="Salvar ${escaparHTML(story.titulo || 'história')} nos favoritos">♡</button>`;
    container.appendChild(card);
  });
}

async function alternarFavorito(storyId) {
  if (!usuarioAtual) { abrirLogin(); return; }
  try {
    const story = historiasOriginais.find(item => item.id === storyId) || {};
    const ref = db.collection('Leitores').doc(usuarioAtual.uid).collection('favoritos').doc(storyId);
    const existing = await ref.get();
    if (existing.exists) {
      await ref.delete();
      alert('História removida dos favoritos.');
    } else {
      await ref.set({
        storyId, titulo: story.titulo || 'História sem título', sinopse: story.sinopse || '',
        genero: story.genero || 'História', autorNome: story.autorNome || 'Leitor Cappu',
        salvoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('História salva nos favoritos! ♥');
    }
  } catch (error) { console.error(error); alert(mensagemAuth(error)); }
}

document.addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) alternarFavorito(favoriteButton.dataset.favorite);
});

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('busca');
  if (search) search.addEventListener('input', () => renderizarProdutos(aplicarFiltroHistorias()));
});

auth.onAuthStateChanged(async user => {
  usuarioAtual = user;
  const loginButton = document.getElementById('btn-login');
  const logoutButton = document.getElementById('btn-logout');
  const adminButton = document.getElementById('btn-admin');
  loginButton?.classList.toggle('d-none', !!user);
  logoutButton?.classList.toggle('d-none', !user);
  if (adminButton) adminButton.classList.add('d-none');
  const avatar = document.getElementById('profileButton');
  if (avatar) avatar.textContent = user ? (user.displayName || user.email || 'CM').trim().charAt(0).toUpperCase() : 'CM';

  if (user) {
    try {
      await garantirPerfilLeitor(user);
      const profileDoc = await db.collection('Leitores').doc(user.uid).get();
      if (adminButton && profileDoc.exists && profileDoc.data().perfil === 'admin') adminButton.classList.remove('d-none');
    } catch (error) { console.error('Não foi possível sincronizar o perfil:', error); }
  }
  authReady = true;
});

// O filtro por gênero da página Explorar continua disponível.
function filtrarGenero(genero) {
  const search = document.getElementById('busca');
  if (search) { search.value = genero; search.dispatchEvent(new Event('input', { bubbles: true })); }
}

document.addEventListener('DOMContentLoaded', () => { carregarProdutos(); });
