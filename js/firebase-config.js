// Configuração pública do Firebase para o cliente web.
// A segurança real é garantida pelas regras do Authentication, Firestore e Storage.
const firebaseConfig = {
  apiKey: "AIzaSyBQ0N8d_7a-DS4XRAbkoIMGsORvxChUh2M",
  authDomain: "cappumind.firebaseapp.com",
  projectId: "cappumind",
  storageBucket: "cappumind.firebasestorage.app"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// O SDK do Storage só é carregado na página administrativa; não falha nas demais páginas.
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;
