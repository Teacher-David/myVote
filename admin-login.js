// admin-login.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const messageEl = document.getElementById('message');
    
    // 로그인 폼 요소들
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginButton = document.getElementById('login-button');
    
    // 회원가입 폼 요소들
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const registerPasswordConfirmInput = document.getElementById('register-password-confirm');
    const registerNameInput = document.getElementById('register-name');
    const registerButton = document.getElementById('register-button');

    // 이미 로그인된 상태 확인
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // 이미 로그인된 경우 관리자 페이지로 리다이렉트
            window.location.href = 'admin.html';
        }
    });

    // 탭 전환 기능
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // 탭 버튼 활성화 상태 변경
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 폼 컨테이너 표시/숨김
            if (tabName === 'login') {
                loginFormContainer.classList.add('active');
                registerFormContainer.classList.remove('active');
            } else {
                loginFormContainer.classList.remove('active');
                registerFormContainer.classList.add('active');
            }
            
            // 메시지 초기화
            messageEl.textContent = '';
            messageEl.className = '';
        });
    });

    // 메시지 표시 함수
    function showMessage(message, type = 'info') {
        messageEl.textContent = message;
        messageEl.className = type;
    }

    // 로그인 처리
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        
        if (!email || !password) {
            showMessage('이메일과 비밀번호를 모두 입력해주세요.', 'error');
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = '로그인 중...';
        showMessage('로그인 중...', 'info');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            showMessage('로그인 성공! 관리자 페이지로 이동합니다...', 'success');
            
            // 잠시 후 관리자 페이지로 이동
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
            
        } catch (error) {
            console.error('로그인 오류:', error);
            let errorMessage = '로그인 중 오류가 발생했습니다.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = '등록되지 않은 이메일입니다.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = '비밀번호가 올바르지 않습니다.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = '유효하지 않은 이메일 형식입니다.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = '비활성화된 계정입니다.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
                    break;
                default:
                    errorMessage = `로그인 오류: ${error.message}`;
            }
            
            showMessage(errorMessage, 'error');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = '로그인';
        }
    });

    // 회원가입 처리
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value.trim();
        const passwordConfirm = registerPasswordConfirmInput.value.trim();
        const name = registerNameInput.value.trim();
        
        // 입력값 검증
        if (!email || !password || !passwordConfirm || !name) {
            showMessage('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        if (password !== passwordConfirm) {
            showMessage('비밀번호가 일치하지 않습니다.', 'error');
            return;
        }
        
        if (password.length < 6) {
            showMessage('비밀번호는 최소 6자 이상이어야 합니다.', 'error');
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = '회원가입 중...';
        showMessage('회원가입 중...', 'info');

        try {
            // Firebase Auth로 사용자 생성
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // 프로필 업데이트
            await updateProfile(user, {
                displayName: name
            });
            
            // Firestore에 사용자 정보 저장
            await setDoc(doc(db, 'teachers', user.uid), {
                name: name,
                email: email,
                createdAt: new Date(),
                role: 'teacher'
            });
            
            showMessage('회원가입 성공! 관리자 페이지로 이동합니다...', 'success');
            
            // 잠시 후 관리자 페이지로 이동
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
            
        } catch (error) {
            console.error('회원가입 오류:', error);
            let errorMessage = '회원가입 중 오류가 발생했습니다.';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = '이미 사용 중인 이메일입니다.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = '유효하지 않은 이메일 형식입니다.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = '이메일/비밀번호 인증이 활성화되지 않았습니다.';
                    break;
                case 'auth/weak-password':
                    errorMessage = '비밀번호가 너무 약합니다.';
                    break;
                default:
                    errorMessage = `회원가입 오류: ${error.message}`;
            }
            
            showMessage(errorMessage, 'error');
        } finally {
            registerButton.disabled = false;
            registerButton.textContent = '회원가입';
        }
    });
});