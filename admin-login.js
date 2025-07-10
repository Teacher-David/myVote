// admin-login.js
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    const authKeyInput = document.getElementById('auth-key');
    const messageEl = document.getElementById('message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageEl.textContent = '';
        const inputKey = authKeyInput.value.trim();

        if (!inputKey) {
            messageEl.textContent = '인증키를 입력해주세요.';
            messageEl.style.color = '#dc3545';
            return;
        }

        try {
            messageEl.textContent = '로그인 중...';
            messageEl.style.color = '#007bff';
            
            // admin 컬렉션에서 인증키 가져오기
            const adminDocRef = doc(db, 'admin', 'config'); // 'config' 문서에 인증키 저장
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                const config = adminDocSnap.data();
                if (config.authKey === inputKey) {
                    // 인증 성공, 세션 스토리지에 플래그 저장
                    sessionStorage.setItem('isTeacherLoggedIn', 'true');
                    sessionStorage.setItem('loginTime', new Date().getTime().toString());
                    messageEl.textContent = '로그인 성공! 관리자 페이지로 이동합니다...';
                    messageEl.style.color = '#28a745';
                    setTimeout(() => {
                        window.location.href = 'admin.html'; // 관리자 페이지로 이동
                    }, 1000);
                } else {
                    messageEl.textContent = '인증키가 올바르지 않습니다.';
                    messageEl.style.color = '#dc3545';
                }
            } else {
                messageEl.textContent = '관리자 설정 정보를 찾을 수 없습니다. Firebase에 admin/config 문서를 생성해주세요.';
                messageEl.style.color = '#dc3545';
                console.warn("No 'admin/config' document found. Please create it manually with an 'authKey' field.");
            }
        } catch (error) {
            console.error("Error during admin login:", error);
            messageEl.textContent = '로그인 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.';
            messageEl.style.color = '#dc3545';
        }
    });
});