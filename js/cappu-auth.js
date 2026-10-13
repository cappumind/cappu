/* Autenticação comum das páginas CappuMind. Requer firebase-config.js antes deste arquivo. */
(function () {
  const backdrop = document.getElementById('authBackdrop');
  const form = document.getElementById('authForm');
  if (!backdrop || !form) return;

  let cadastro = false;
  let enviando = false;
  const message = document.getElementById('authMessage');
  const submit = document.getElementById('authSubmit');
  const switchButton = document.getElementById('authSwitch');
  const resetButton = document.getElementById('authReset');
  const title = document.getElementById('authTitle');
  const nameField = document.getElementById('authNameField');
  const nameInput = document.getElementById('authName');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const loginButtons = document.querySelectorAll('.page-login');
  const logoutButtons = document.querySelectorAll('.page-logout');
  const adminLinks = document.querySelectorAll('.page-admin');

  function open() {
    backdrop.hidden = false;
    message.textContent = '';
    setMode(false);
    window.setTimeout(() => emailInput.focus(), 0);
  }
  function close() { backdrop.hidden = true; }
  function setMode(isCadastro) {
    cadastro = isCadastro;
    title.textContent = cadastro ? 'Crie sua conta' : 'Entre para continuar';
    submit.textContent = cadastro ? 'Criar conta' : 'Entrar';
    switchButton.textContent = cadastro ? 'Já tenho conta · Entrar' : 'Ainda não tenho conta · Cadastrar';
    passwordInput.autocomplete = cadastro ? 'new-password' : 'current-password';
    nameField.hidden = !cadastro;
    if (nameInput) nameInput.required = false;
    message.textContent = '';
    resetButton.hidden = cadastro;
  }

  loginButtons.forEach(button => button.addEventListener('click', open));
  backdrop.querySelector('.auth-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !backdrop.hidden) close(); });
  switchButton.addEventListener('click', () => setMode(!cadastro));
  logoutButtons.forEach(button => button.addEventListener('click', async () => {
    try { await auth.signOut(); window.location.href = 'index.html'; }
    catch (error) { showError(error); }
  }));

  function showError(error) {
    console.error('Erro de autenticação CappuMind:', error);
    message.textContent = friendlyError(error);
  }
  function friendlyError(error) {
    const code = error && error.code;
    const known = {
      'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre na sua conta.',
      'auth/invalid-email': 'Digite um e-mail válido.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
      'auth/network-request-failed': 'Falha de conexão. Confira sua internet e tente novamente.',
      'auth/operation-not-allowed': 'O login por e-mail e senha não está ativado no Firebase Authentication.',
      'permission-denied': 'O Firebase recusou a operação. Confira as regras do Firestore.'
    };
    return known[code] || 'Não foi possível concluir. Confira os dados e tente novamente.';
  }

  async function ensureReaderProfile(user, name = '') {
    const ref = db.collection('Leitores').doc(user.uid);
    const existing = await ref.get();
    if (existing.exists) return;
    const data = {
      email: user.email || '',
      perfil: 'cliente',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    const readerName = name.trim() || user.displayName || '';
    if (readerName) data.nome = readerName;
    await ref.set(data, { merge: true });
  }

  resetButton.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) { message.textContent = 'Digite seu e-mail para receber o link de recuperação.'; emailInput.focus(); return; }
    try {
      await auth.sendPasswordResetEmail(email);
      message.textContent = 'Se houver uma conta com esse e-mail, enviaremos as instruções para redefinir a senha.';
    } catch (error) { showError(error); }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (enviando) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const name = nameInput?.value.trim() || '';
    if (!email || !password) { message.textContent = 'Preencha o e-mail e a senha.'; return; }
    if (cadastro && password.length < 6) { message.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    enviando = true;
    submit.disabled = true;
    switchButton.disabled = true;
    resetButton.disabled = true;
    message.textContent = cadastro ? 'Criando sua conta...' : 'Entrando...';
    try {
      if (cadastro) {
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        if (name) await credential.user.updateProfile({ displayName: name });
        await db.collection('Leitores').doc(credential.user.uid).set({
          email,
          ...(name ? { nome: name } : {}),
          perfil: 'cliente',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const credential = await auth.signInWithEmailAndPassword(email, password);
        await ensureReaderProfile(credential.user);
      }
      form.reset();
      close();
      setMode(false);
    } catch (error) {
      showError(error);
    } finally {
      enviando = false;
      submit.disabled = false;
      switchButton.disabled = false;
      resetButton.disabled = false;
    }
  });

  auth.onAuthStateChanged(async user => {
    loginButtons.forEach(button => { button.hidden = !!user; });
    logoutButtons.forEach(button => { button.hidden = !user; });
    adminLinks.forEach(link => { link.hidden = true; });
    document.querySelectorAll('.page-profile').forEach(link => {
      link.textContent = user ? ((user.displayName || user.email || 'CM').trim().charAt(0).toUpperCase()) : 'CM';
      link.title = user ? (user.displayName || user.email || 'Meu perfil') : 'Meu perfil';
    });
    if (user) {
      try {
        await ensureReaderProfile(user);
        const profile = await db.collection('Leitores').doc(user.uid).get();
        const isAdmin = profile.exists && profile.data().perfil === 'admin';
        adminLinks.forEach(link => { link.hidden = !isAdmin; });
      } catch (error) { console.error('Não foi possível verificar o perfil do leitor:', error); }
    }
    document.dispatchEvent(new CustomEvent('cappu:auth', { detail: { user } }));
  });

  window.CappuAuth = { open, close, friendlyError };
  window.CappuFavorites = {
    async toggle(storyId, story = {}) {
      const user = auth.currentUser;
      if (!user) { open(); return false; }
      if (!storyId || String(storyId).includes('/')) throw new Error('Identificador de história inválido.');
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
