/* Autenticação compartilhada das páginas novas. Requer js/firebase-config.js antes deste arquivo. */
(function () {
  const backdrop = document.getElementById('authBackdrop');
  const form = document.getElementById('authForm');
  if (!backdrop || !form) return;
  let cadastro = false;
  const message = document.getElementById('authMessage');
  const submit = document.getElementById('authSubmit');
  const switchButton = document.getElementById('authSwitch');
  const title = document.getElementById('authTitle');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const loginButtons = document.querySelectorAll('.page-login');
  const logoutButtons = document.querySelectorAll('.page-logout');

  function open() { backdrop.hidden = false; message.textContent = ''; emailInput.focus(); }
  function close() { backdrop.hidden = true; }
  function setMode(isCadastro) {
    cadastro = isCadastro;
    title.textContent = cadastro ? 'Crie sua conta' : 'Entre para continuar';
    submit.textContent = cadastro ? 'Criar conta' : 'Entrar';
    switchButton.textContent = cadastro ? 'Já tenho conta · Entrar' : 'Ainda não tenho conta · Cadastrar';
    passwordInput.autocomplete = cadastro ? 'new-password' : 'current-password';
    message.textContent = '';
  }
  loginButtons.forEach(button => button.addEventListener('click', open));
  backdrop.querySelector('.auth-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  switchButton.addEventListener('click', () => setMode(!cadastro));
  logoutButtons.forEach(button => button.addEventListener('click', () => auth.signOut().catch(showError)));

  function showError(error) {
    console.error(error);
    message.textContent = friendlyError(error);
  }
  function friendlyError(error) {
    const code = error && error.code;
    const known = {
      'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
      'auth/invalid-email': 'Digite um e-mail válido.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'permission-denied': 'O Firebase recusou a operação. Confira as regras do Firestore.'
    };
    return known[code] || (error && error.message) || 'Não foi possível concluir. Tente novamente.';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = cadastro ? 'Criando sua conta...' : 'Entrando...';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    try {
      if (cadastro) {
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('Leitores').doc(credential.user.uid).set({
          email,
          perfil: 'cliente',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
      close();
      form.reset();
      setMode(false);
    } catch (error) {
      showError(error);
    } finally {
      submit.disabled = false;
    }
  });

  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(user => {
      loginButtons.forEach(button => { button.hidden = !!user; });
      logoutButtons.forEach(button => { button.hidden = !user; });
      document.querySelectorAll('.page-profile').forEach(link => {
        link.textContent = user ? ((user.displayName || user.email || 'CM').trim().charAt(0).toUpperCase()) : 'CM';
        link.title = user ? (user.displayName || user.email || 'Meu perfil') : 'Meu perfil';
      });
      document.dispatchEvent(new CustomEvent('cappu:auth', { detail: { user } }));
    });
  }
  window.CappuAuth = { open, close, friendlyError };
  // API compartilhada: pode ser chamada pelos cards de Explorar e pela página de leitura.
  window.CappuFavorites = {
    async toggle(storyId, story = {}) {
      const user = auth.currentUser;
      if (!user) { open(); return false; }
      const ref = db.collection('Leitores').doc(user.uid).collection('favoritos').doc(storyId);
      const existing = await ref.get();
      if (existing.exists) { await ref.delete(); return false; }
      await ref.set({
        storyId,
        titulo: story.titulo || 'História sem título',
        sinopse: story.sinopse || '',
        genero: story.genero || 'História',
        autorNome: story.autorNome || 'Leitor Cappu',
        salvoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    }
  };
})();
