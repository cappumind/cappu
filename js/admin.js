/* Painel administrativo do CappuMind. O Firestore também deve aplicar as permissões. */
let usuarioAtual = null;
let historiaEmEdicao = null;
let historiasAdmin = [];
let leitoresAdmin = [];

function logout() {
  auth.signOut().then(() => { window.location.href = 'index.html'; })
    .catch(error => { console.error(error); alert('Não foi possível sair da conta.'); });
}
function escapeAdmin(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function isAdminRole(profile) { return !!profile && profile.perfil === 'admin'; }

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.replace('index.html'); return; }
  usuarioAtual = user;
  try {
    const profile = await db.collection('Leitores').doc(user.uid).get();
    if (!profile.exists || !isAdminRole(profile.data())) {
      alert('Acesso negado. Esta área é exclusiva para administradores.');
      window.location.replace('index.html');
      return;
    }
    document.body.hidden = false;
    await Promise.all([carregarHistoriasAdmin(), carregarUsuarios(), carregarComunidadeCount()]);
  } catch (error) {
    console.error('Não foi possível validar as permissões administrativas:', error);
    alert('Não foi possível validar suas permissões. Tente novamente.');
    window.location.replace('index.html');
  }
});

async function carregarHistoriasAdmin() {
  const body = document.getElementById('produtosAdmin');
  try {
    const snapshot = await db.collection('historias').get();
    historiasAdmin = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    historiasAdmin.sort((a, b) => (b.atualizadoEm?.toMillis?.() || 0) - (a.atualizadoEm?.toMillis?.() || 0));
    const publicadas = historiasAdmin.filter(story => story.status === 'publicada').length;
    const total = document.getElementById('totalProdutos');
    if (total) total.textContent = publicadas;
    if (!body) return;
    body.innerHTML = '';
    if (!historiasAdmin.length) {
      body.innerHTML = '<tr><td colspan="5">Ainda não há histórias cadastradas.</td></tr>';
      return;
    }
    historiasAdmin.forEach(story => {
      const row = document.createElement('tr');
      const statusLabel = story.status === 'publicada' ? 'Publicada' : story.status === 'bloqueada' ? 'Bloqueada' : 'Rascunho';
      row.innerHTML = `<td>${escapeAdmin(story.titulo || 'Sem título')}</td><td>${escapeAdmin(story.autorNome || 'Leitor Cappu')}</td><td>${escapeAdmin(story.genero || '—')}</td><td>${escapeAdmin(statusLabel)}</td><td><button class="btn btn-sm btn-outline-secondary me-1" type="button" data-edit-story="${escapeAdmin(story.id)}">Editar</button><button class="btn btn-sm btn-outline-danger" type="button" data-delete-story="${escapeAdmin(story.id)}">Excluir</button></td>`;
      body.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar histórias para administração:', error);
    if (body) body.innerHTML = '<tr><td colspan="5">Não foi possível carregar as histórias. Confira as regras do Firestore.</td></tr>';
  }
}

function abrirModalProduto() {
  historiaEmEdicao = null;
  document.querySelector('#produtoModal h5').textContent = 'Nova história';
  ['nomeProduto', 'autorProduto', 'descricaoProduto', 'conteudoHistoriaAdmin'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('categoriaProduto').value = '';
  document.getElementById('statusProduto').value = 'publicada';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('produtoModal')).show();
}

async function editarProduto(id) {
  const story = historiasAdmin.find(item => item.id === id);
  if (!story) return;
  historiaEmEdicao = id;
  document.querySelector('#produtoModal h5').textContent = 'Editar história';
  document.getElementById('nomeProduto').value = story.titulo || '';
  document.getElementById('autorProduto').value = story.autorNome || '';
  document.getElementById('categoriaProduto').value = story.genero || '';
  document.getElementById('statusProduto').value = story.status || 'rascunho';
  document.getElementById('descricaoProduto').value = story.sinopse || '';
  try {
    const content = await db.collection('historias').doc(id).collection('conteudo').doc('full').get();
    document.getElementById('conteudoHistoriaAdmin').value = content.exists ? (content.data().texto || '') : '';
  } catch (error) {
    console.error(error);
    document.getElementById('conteudoHistoriaAdmin').value = '';
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('produtoModal')).show();
}

window.salvarProduto = async function salvarProdutoAdmin() {
  if (!usuarioAtual) return;
  const titulo = document.getElementById('nomeProduto').value.trim();
  const autorNome = document.getElementById('autorProduto').value.trim() || usuarioAtual.displayName || 'Leitor Cappu';
  const genero = document.getElementById('categoriaProduto').value;
  const status = document.getElementById('statusProduto').value;
  const sinopse = document.getElementById('descricaoProduto').value.trim();
  const texto = document.getElementById('conteudoHistoriaAdmin').value.trim();
  if (!titulo || !genero || !sinopse || !texto) {
    alert('Preencha título, gênero, sinopse e texto completo antes de salvar.'); return;
  }
  if (titulo.length > 100 || sinopse.length > 500 || texto.length > 200000) {
    alert('Confira os limites: título até 100, sinopse até 500 e texto até 200.000 caracteres.'); return;
  }
  const button = document.querySelector('#produtoModal .admin-modal-actions .cappu-btn:last-child');
  if (button) button.disabled = true;
  try {
    const ref = historiaEmEdicao ? db.collection('historias').doc(historiaEmEdicao) : db.collection('historias').doc();
    const existing = historiaEmEdicao ? await ref.get() : null;
    const previous = existing?.exists ? existing.data() : {};
    const metadata = {
      titulo, autorNome, genero, sinopse,
      autorUid: previous.autorUid || usuarioAtual.uid,
      status,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      criadoEm: previous.criadoEm || firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(metadata, { merge: true });
    await ref.collection('conteudo').doc('full').set({ texto, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    bootstrap.Modal.getInstance(document.getElementById('produtoModal'))?.hide();
    mostrarMensagem('História salva com sucesso.', 'success');
    await carregarHistoriasAdmin();
  } catch (error) {
    console.error('Erro ao salvar história:', error);
    mostrarMensagem('Não foi possível salvar. Confira as regras do Firestore.', 'danger');
  } finally { if (button) button.disabled = false; }
};

async function excluirHistoria(id) {
  if (!confirm('Deseja excluir esta história? Esta ação não pode ser desfeita.')) return;
  try {
    const ref = db.collection('historias').doc(id);
    await ref.collection('conteudo').doc('full').delete().catch(() => {});
    await ref.delete();
    mostrarMensagem('História excluída.', 'success');
    await carregarHistoriasAdmin();
  } catch (error) {
    console.error(error);
    mostrarMensagem('Não foi possível excluir. Confira as regras do Firestore.', 'danger');
  }
}

document.getElementById('produtosAdmin')?.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-story]');
  const remove = event.target.closest('[data-delete-story]');
  if (edit) editarProduto(edit.dataset.editStory);
  if (remove) excluirHistoria(remove.dataset.deleteStory);
});

async function carregarUsuarios() {
  const body = document.getElementById('usuariosAdmin');
  try {
    const snapshot = await db.collection('Leitores').get();
    leitoresAdmin = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const total = document.getElementById('totalUsuarios');
    if (total) total.textContent = leitoresAdmin.length;
    renderizarUsuarios(leitoresAdmin);
  } catch (error) {
    console.error('Erro ao carregar leitores:', error);
    if (body) body.innerHTML = '<tr><td colspan="5">Não foi possível carregar leitores. Confira as regras do Firestore.</td></tr>';
  }
}
function renderizarUsuarios(list) {
  const body = document.getElementById('usuariosAdmin');
  if (!body) return;
  body.innerHTML = '';
  if (!list.length) { body.innerHTML = '<tr><td colspan="5">Nenhum leitor cadastrado.</td></tr>'; return; }
  list.forEach(reader => {
    const row = document.createElement('tr');
    const name = reader.nome || 'Leitor Cappu';
    const email = reader.email || 'E-mail não disponível';
    row.innerHTML = `<td>${escapeAdmin(name)}</td><td>${escapeAdmin(email)}</td><td>${reader.perfil === 'admin' ? 'Administrador' : 'Leitor'}</td><td>Ativo</td><td>${reader.perfil === 'admin' ? '<span class="badge bg-success">Admin</span>' : `<button class="btn btn-sm btn-outline-success" type="button" data-promote="${escapeAdmin(reader.id)}">Tornar admin</button>`}</td>`;
    body.appendChild(row);
  });
}

document.getElementById('usuariosAdmin')?.addEventListener('click', event => {
  const button = event.target.closest('[data-promote]');
  if (button) promover(button.dataset.promote);
});
document.getElementById('buscaUsuario')?.addEventListener('input', event => {
  const query = event.target.value.trim().toLocaleLowerCase('pt-BR');
  renderizarUsuarios(leitoresAdmin.filter(reader => `${reader.nome || ''} ${reader.email || ''}`.toLocaleLowerCase('pt-BR').includes(query)));
});

async function promover(uid) {
  if (!usuarioAtual || uid === usuarioAtual.uid) {
    alert('Não é possível alterar o próprio perfil administrativo por esta ação.'); return;
  }
  if (!confirm('Deseja conceder permissões administrativas a este leitor?')) return;
  try {
    await db.collection('Leitores').doc(uid).update({ perfil: 'admin' });
    mostrarMensagem('Permissão administrativa atualizada.', 'success');
    await carregarUsuarios();
  } catch (error) {
    console.error('Erro ao promover leitor:', error);
    mostrarMensagem('Não foi possível alterar a permissão. Confira as regras do Firestore.', 'danger');
  }
}

async function carregarComunidadeCount() {
  try {
    const snapshot = await db.collection('comunidade').get();
    const total = document.getElementById('totalPublicacoes');
    if (total) total.textContent = snapshot.size;
  } catch (error) { console.error('Erro ao contar publicações:', error); }
}

function mostrarMensagem(texto, tipo = 'info') {
  const el = document.getElementById('mensagem');
  if (el) {
    el.className = 'alert alert-' + tipo;
    el.textContent = texto;
    el.classList.remove('d-none');
    window.setTimeout(() => el.classList.add('d-none'), 3000);
    return;
  }
  // O painel novo não tem um alerta fixo; usa uma mensagem simples sem HTML dinâmico.
  alert(texto);
}
