// student-vote.js
import { db, functions } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pollId = urlParams.get('pollId');

    if (!pollId) {
        alert('잘못된 접근입니다. 투표 ID가 없습니다.');
        window.location.href = 'index.html';
        return;
    }

    const pollTitleEl = document.getElementById('poll-title');
    const optionsContainer = document.getElementById('options-container');
    const studentIdInput = document.getElementById('student-id');
    const voteButton = document.getElementById('vote-button');
    const messageEl = document.getElementById('message');
    const voteForm = document.getElementById('vote-form');

    const getPollOptions = httpsCallable(functions, 'getPollOptions');
    const submitVoteFunction = httpsCallable(functions, 'submitVote');

    let pollData;

    // 투표 정보 로드 (polls 컬렉션은 학생 읽기 가능)
    try {
        const pollDocRef = doc(db, 'polls', pollId);
        const pollSnapshot = await getDoc(pollDocRef);

        if (!pollSnapshot.exists()) {
            alert('존재하지 않는 투표입니다.');
            window.location.href = 'index.html';
            return;
        }
        pollData = pollSnapshot.data();
        pollTitleEl.textContent = pollData.title;

        if (pollData.status === 'ended') {
            optionsContainer.innerHTML = '<p class="error">이 투표는 이미 종료되었습니다.</p>';
            studentIdInput.disabled = true;
            voteButton.disabled = true;
            return;
        }

        // Cloud Function을 통해 선택지 데이터 가져오기
        const optionsResult = await getPollOptions({ pollId: pollId });
        const optionsData = optionsResult.data.options;

        if (!optionsData || optionsData.length === 0) {
            optionsContainer.innerHTML = '<p>선택지가 없습니다.</p>';
            voteButton.disabled = true;
            return;
        }

        optionsContainer.innerHTML = ''; // 기존 메시지 삭제
        optionsData.forEach((option) => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `
                <input type="radio" id="option-${option.id}" name="voteOption" value="${option.id}" required>
                <label for="option-${option.id}">${option.optionName}</label>
            `;
            optionsContainer.appendChild(div);
        });

    } catch (error) {
        console.error("Error loading poll or options: ", error);
        messageEl.textContent = '투표 정보를 불러오는 데 실패했습니다.';
        messageEl.className = 'error';
        voteButton.disabled = true;
        return;
    }

    // 투표 제출 처리
    voteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageEl.textContent = ''; // 이전 메시지 초기화

        const selectedOption = document.querySelector('input[name="voteOption"]:checked');
        const studentId = studentIdInput.value.trim();

        if (!selectedOption) {
            messageEl.textContent = '선택지를 선택해주세요.';
            messageEl.className = 'error';
            return;
        }
        if (!studentId) {
            messageEl.textContent = '학번을 입력해주세요.';
            messageEl.className = 'error';
            return;
        }

        voteButton.disabled = true; // 중복 클릭 방지
        messageEl.textContent = '투표를 처리하는 중...';
        messageEl.className = '';

        try {
            // Cloud Function 호출하여 투표 제출
            const result = await submitVoteFunction({
                pollId: pollId,
                optionId: selectedOption.value,
                studentId: studentId // 학번을 Cloud Function으로 전달
            });

            if (result.data.success) {
                messageEl.textContent = '투표가 성공적으로 완료되었습니다!';
                messageEl.className = 'success';
                studentIdInput.disabled = true;
                document.querySelectorAll('input[name="voteOption"]').forEach(radio => radio.disabled = true);
                voteButton.disabled = true;
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                // Cloud Function에서 발생한 에러 메시지 표시
                throw new Error(result.data.message || '알 수 없는 오류');
            }

        } catch (error) {
            console.error("Error submitting vote: ", error);
            if (error.code === 'already-exists') {
                messageEl.textContent = '이미 이 투표에 참여하셨습니다.';
            } else if (error.code === 'invalid-argument') {
                messageEl.textContent = error.message; // Cloud Function에서 던진 메시지 사용
            } else {
                messageEl.textContent = '투표 중 오류가 발생했습니다. 다시 시도해주세요.';
            }
            messageEl.className = 'error';
            voteButton.disabled = false; // 에러 발생 시 버튼 활성화
        }
    });
});