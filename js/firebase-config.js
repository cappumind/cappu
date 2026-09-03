
const firebaseConfig = {
    apiKey: "AIzaSyBQ0N8d_7a-DS4XRAbkoIMGsORvxChUh2M",
    authDomain: "cappumind.firebaseapp.com",
    projectId: "cappumind",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const storage = firebase.storage();