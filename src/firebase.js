import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Config do Firebase Web — estes valores são PÚBLICOS por design (vão para o
// navegador de qualquer forma). Não são segredo. A proteção dos dados é feita
// pelas Firestore Security Rules (ver firestore.rules), que restringem cada
// usuário ao seu próprio namespace em /usuarios/{uid}.
const firebaseConfig = {
  apiKey: "AIzaSyApTKmaEmJ3Z4Wh1HfHEVxz03YxG6P567k",
  authDomain: "uberfinances-e7d4e.firebaseapp.com",
  projectId: "uberfinances-e7d4e",
  storageBucket: "uberfinances-e7d4e.appspot.com",
  messagingSenderId: "600832145121",
  appId: "1:600832145121:web:8d0a2ed6bac68851fc29a0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
