// firebase-config.js (Firebase 초기화 설정)
// **중요**: 여기에 Firebase 프로젝트의 실제 설정을 입력하세요.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';

const firebaseConfig = {
  apiKey: "AIzaSyD3FQSeyPeI7BCQVLe5CyAym-hR7x-2G8s",
  authDomain: "myweb-5e309.firebaseapp.com",
  projectId: "myweb-5e309",
  storageBucket: "myweb-5e309.firebasestorage.app",
  messagingSenderId: "417447127215",
  appId: "1:417447127215:web:739aa4152da19629564c5a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Auth 상태 변화 디버깅 (선택사항)
// import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
// onAuthStateChanged(auth, (user) => {
//     if (user) {
//         console.log('User logged in:', user.uid, user.email);
//     } else {
//         console.log('User logged out');
//     }
// });