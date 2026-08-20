let usuarioPerfil = null;

auth.onAuthStateChanged(async (user) => {

  //if (!user) {
    //window.location.href = "index.html";
    //return;
  //}

  usuarioPerfil = user;

  // Email do Firebase Authentication
  const emailElement = document.getElementById("perfilEmail");

  if (emailElement) {
    emailElement.textContent = user.email || "Email não informado";
  }


  // Buscar informações do usuário no Firestore

  try {

    const doc = await db
      .collection("Leitores")
      .doc(user.uid)
      .get();

    if (doc.exists) {

      const dados = doc.data();

      const nomeElement =
        document.getElementById("perfilNome");

      if (dados.nome && nomeElement) {
        nomeElement.textContent =
          `Olá, ${dados.nome}! ☕`;
      }

    }

  } catch (erro) {

    console.error(
      "Erro ao carregar perfil:",
      erro
    );

  }

});