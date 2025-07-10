// admin-management.js
import { db, functions } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, getDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';

// Chart.js 전역 변수
let resultsChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // 세션 스토리지에서 로그인 상태 확인
    if (sessionStorage.getItem('isTeacherLoggedIn') !== 'true') {
        alert('관리자 로그인이 필요합니다.');
        window.location.href = 'admin-login.html';
        return;
    }

    // 로그인 시간 체크 (24시간 후 자동 로그아웃)
    const loginTime = sessionStorage.getItem('loginTime');
    if (loginTime) {
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - parseInt(loginTime);
        if (timeDiff > 24 * 60 * 60 * 1000) { // 24시간
            sessionStorage.removeItem('isTeacherLoggedIn');
            sessionStorage.removeItem('loginTime');
            alert('로그인 시간이 만료되었습니다. 다시 로그인해주세요.');
            window.location.href = 'admin-login.html';
            return;
        }
    }

    const pollTableBody = document.querySelector('#poll-table tbody');
    const createPollBtn = document.getElementById('create-poll-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const createEditModal = document.getElementById('create-edit-modal');
    const resultsModal = document.getElementById('results-modal');
    const closeButtons = document.querySelectorAll('.close-button');
    const pollForm = document.getElementById('poll-form');
    const pollTitleInput = document.getElementById('poll-title-input');
    const endDateInput = document.getElementById('end-date-input');
    const optionsFormContainer = document.getElementById('options-form-container');
    const addOptionBtn = document.getElementById('add-option-btn');
    const modalTitle = document.getElementById('modal-title');
    const savePollBtn = document.getElementById('save-poll-btn');
    const cancelPollBtn = document.getElementById('cancel-poll-btn');
    const resultsPollTitle = document.getElementById('results-poll-title');

    // 로그아웃 버튼 이벤트
    logoutBtn.addEventListener('click', () => {
        if (confirm('정말 로그아웃하시겠습니까?')) {
            sessionStorage.removeItem('isTeacherLoggedIn');
            sessionStorage.removeItem('loginTime');
            window.location.href = 'index.html';
        }
    });
    const voterListEl = document.getElementById('voter-list');

    let editingPollId = null; // 수정 중인 투표 ID

    // Cloud Functions 호출 가능한 함수 정의 (안전한 방식으로)
    let deletePollAndVotesFunction = null;
    let getPollResultsFunction = null;
    
    try {
        deletePollAndVotesFunction = httpsCallable(functions, 'deletePollAndVotes');
        getPollResultsFunction = httpsCallable(functions, 'getPollResults');
        console.log('Firebase Functions loaded successfully');
    } catch (error) {
        console.warn('Firebase Functions not available:', error);
    }


    // 모달 닫기
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            createEditModal.style.display = 'none';
            resultsModal.style.display = 'none';
        });
    });

    // 외부 클릭 시 모달 닫기
    window.addEventListener('click', (event) => {
        if (event.target == createEditModal) {
            createEditModal.style.display = 'none';
        }
        if (event.target == resultsModal) {
            resultsModal.style.display = 'none';
        }
    });

    // 새 투표 생성 버튼 클릭
    createPollBtn.addEventListener('click', () => {
        editingPollId = null;
        modalTitle.textContent = '새 투표 생성';
        pollForm.reset();
        optionsFormContainer.innerHTML = `
            <div class="option-input-group">
                <input type="text" class="option-input" placeholder="선택지 1" required>
                <button type="button" class="remove-option-btn" style="display:none;">삭제</button>
            </div>
        `; // 초기 선택지 하나
        createEditModal.style.display = 'block';
    });

    // 선택지 추가 버튼
    addOptionBtn.addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'option-input-group';
        div.innerHTML = `
            <input type="text" class="option-input" placeholder="새로운 선택지" required>
            <button type="button" class="remove-option-btn">삭제</button>
        `;
        optionsFormContainer.appendChild(div);
        div.querySelector('.remove-option-btn').addEventListener('click', (e) => {
            e.target.closest('.option-input-group').remove();
        });
    });

    // 동적으로 생성된 삭제 버튼 이벤트 위임
    optionsFormContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-option-btn')) {
            e.target.closest('.option-input-group').remove();
        }
    });

    // 폼 제출 (투표 생성/수정)
    pollForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        console.log('Form submitted');

        const title = pollTitleInput.value.trim();
        const endDateStr = endDateInput.value;
        const endDate = endDateStr ? new Date(endDateStr) : null;
        const optionInputs = optionsFormContainer.querySelectorAll('.option-input');
        const options = Array.from(optionInputs).map(input => ({
            optionName: input.value.trim(),
            voteCount: 0 // 초기 voteCount
        })).filter(opt => opt.optionName !== '');

        console.log('Form data:', { title, endDate, options });

        if (!title) {
            alert('투표 제목을 입력해주세요.');
            return;
        }

        if (options.length === 0) {
            alert('최소 하나 이상의 선택지를 입력해주세요.');
            return;
        }

        // 버튼 비활성화
        savePollBtn.disabled = true;
        savePollBtn.textContent = '저장 중...';

        try {
            if (editingPollId) {
                // 투표 수정
                const pollRef = doc(db, 'polls', editingPollId);
                await updateDoc(pollRef, {
                    title: title,
                    endDate: endDate,
                });
                alert('투표가 수정되었습니다.');
            } else {
                // 새 투표 생성
                console.log('Creating new poll with data:', { title, endDate, options });
                
                const newPollRef = await addDoc(collection(db, 'polls'), {
                    title: title,
                    status: 'active', // 기본적으로 'active' 상태로 생성
                    endDate: endDate,
                    createdAt: new Date()
                });

                console.log('Poll created with ID:', newPollRef.id);

                // 선택지 추가 (서브컬렉션에 저장)
                const batch = writeBatch(db);
                options.forEach(option => {
                    const optionRef = doc(collection(db, 'polls', newPollRef.id, 'options'));
                    batch.set(optionRef, option);
                });
                await batch.commit();
                
                console.log('Options added successfully');
                alert('새 투표가 생성되었습니다.');
            }
            createEditModal.style.display = 'none';
        } catch (error) {
            console.error("Error saving poll: ", error);
            console.error("Error details:", error.message);
            console.error("Error code:", error.code);
            alert(`투표 저장 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            // 버튼 다시 활성화
            savePollBtn.disabled = false;
            savePollBtn.textContent = '저장';
        }
    });

    // 모달 취소 버튼
    cancelPollBtn.addEventListener('click', () => {
        createEditModal.style.display = 'none';
    });


    // 투표 목록 실시간 업데이트
    const pollsQuery = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
    onSnapshot(pollsQuery, (snapshot) => {
        pollTableBody.innerHTML = '';
        if (snapshot.empty) {
            pollTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">생성된 투표가 없습니다.</td></tr>';
            return;
        }

        snapshot.forEach((doc) => {
            const poll = doc.data();
            const pollId = doc.id;
            const row = pollTableBody.insertRow();

            row.insertCell(0).textContent = poll.title;
            const statusCell = row.insertCell(1);
            statusCell.innerHTML = `
                <button class="status-toggle ${poll.status}" data-poll-id="${pollId}" data-current-status="${poll.status}">
                    ${poll.status === 'active' ? '진행 중' : '종료됨'}
                </button>
            `;
            row.insertCell(2).textContent = poll.endDate ? new Date(poll.endDate.toDate()).toLocaleString() : '없음';
            row.insertCell(3).textContent = new Date(poll.createdAt.toDate()).toLocaleString();

            const actionsCell = row.insertCell(4);
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `
                <button class="edit-btn" data-poll-id="${pollId}">수정</button>
                <button class="view-btn" data-poll-id="${pollId}">결과보기</button>
                <button class="delete-btn" data-poll-id="${pollId}">삭제</button>
            `;
        });
    });

    // 이벤트 위임을 통한 버튼 클릭 처리
    pollTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const pollId = target.dataset.pollId;

        if (target.classList.contains('status-toggle')) {
            const currentStatus = target.dataset.currentStatus;
            const newStatus = currentStatus === 'active' ? 'ended' : 'active';
            if (confirm(`투표 상태를 "${newStatus === 'active' ? '진행 중' : '종료됨'}"으로 변경하시겠습니까?`)) {
                try {
                    const pollRef = doc(db, 'polls', pollId);
                    await updateDoc(pollRef, { status: newStatus });
                    alert('상태가 변경되었습니다.');
                } catch (error) {
                    console.error("Error updating status: ", error);
                    alert('상태 변경 중 오류가 발생했습니다.');
                }
            }
        } else if (target.classList.contains('edit-btn')) {
            editingPollId = pollId;
            modalTitle.textContent = '투표 수정';
            const pollRef = doc(db, 'polls', pollId);
            const pollSnap = await getDoc(pollRef);
            if (pollSnap.exists()) {
                const pollData = pollSnap.data();
                pollTitleInput.value = pollData.title;
                if (pollData.endDate) {
                    endDateInput.value = new Date(pollData.endDate.toDate()).toISOString().slice(0, 16);
                } else {
                    endDateInput.value = '';
                }

                // 기존 옵션 로드 및 폼에 추가
                const optionsSnap = await getDocs(collection(db, 'polls', pollId, 'options'));
                optionsFormContainer.innerHTML = '';
                optionsSnap.forEach(optionDoc => {
                    const option = optionDoc.data();
                    const div = document.createElement('div');
                    div.className = 'option-input-group';
                    div.innerHTML = `
                        <input type="text" class="option-input" value="${option.optionName}" required>
                        <button type="button" class="remove-option-btn">삭제</button>
                    `;
                    optionsFormContainer.appendChild(div);
                });
                if (optionsSnap.empty) {
                     optionsFormContainer.innerHTML = `
                        <div class="option-input-group">
                            <input type="text" class="option-input" placeholder="선택지 1" required>
                            <button type="button" class="remove-option-btn" style="display:none;">삭제</button>
                        </div>
                    `;
                }

                createEditModal.style.display = 'block';
            } else {
                alert('투표 정보를 찾을 수 없습니다.');
            }

        } else if (target.classList.contains('view-btn')) {
            await showPollResults(pollId);
            resultsModal.style.display = 'block';
        } else if (target.classList.contains('delete-btn')) {
            if (confirm('정말로 이 투표를 삭제하시겠습니까? 관련 투표 기록도 모두 삭제됩니다.')) {
                try {
                    // Cloud Function 호출하여 관련 데이터 일괄 삭제
                    const result = await deletePollAndVotesFunction({ pollId: pollId });
                    if (result.data.success) {
                        alert('투표가 성공적으로 삭제되었습니다.');
                    } else {
                        alert(`투표 삭제 실패: ${result.data.message || result.data.error}`);
                    }
                } catch (error) {
                    console.error("Error deleting poll: ", error);
                    alert('투표 삭제 중 오류가 발생했습니다.');
                }
            }
        }
    });

    // 투표 결과 표시 함수 (Cloud Function 호출)
    async function showPollResults(pollId) {
        resultsPollTitle.textContent = '투표 결과 불러오는 중...';
        voterListEl.innerHTML = '<p>참여자 목록을 불러오는 중...</p>';

        try {
            const result = await getPollResultsFunction({ pollId: pollId });
            const { pollTitle, options, voters } = result.data;

            if (!options) {
                resultsPollTitle.textContent = '투표를 찾을 수 없거나 결과가 없습니다.';
                return;
            }
            resultsPollTitle.textContent = `"${pollTitle}" 투표 결과`;

            const labels = options.map(opt => opt.optionName);
            const data = options.map(opt => opt.voteCount);

            // Chart.js로 막대 그래프 그리기
            const ctx = document.getElementById('results-chart').getContext('2d');
            if (resultsChart) {
                resultsChart.destroy(); // 기존 차트가 있다면 파괴
            }
            resultsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '투표 수',
                        data: data,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)',
                            'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
                            'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });

            // 투표 참여자 목록 표시
            voterListEl.innerHTML = '';
            if (!voters || voters.length === 0) {
                voterListEl.innerHTML = '<p>아직 투표 참여자가 없습니다.</p>';
            } else {
                const ul = document.createElement('ul');
                voters.forEach(voter => {
                    const li = document.createElement('li');
                    li.textContent = `학번 해시: ${voter.userId} - 선택: ${voter.optionName} (${new Date(voter.timestamp._seconds * 1000).toLocaleString()})`; // Cloud Function에서 timestamp가 _seconds/_nanoseconds 객체로 올 수 있음
                    ul.appendChild(li);
                });
                voterListEl.appendChild(ul);
            }

        } catch (error) {
            console.error("Error fetching poll results via Cloud Function: ", error);
            resultsPollTitle.textContent = '투표 결과를 불러오는 데 오류가 발생했습니다.';
            voterListEl.innerHTML = '<p style="color: red;">참여자 목록을 불러오는 데 오류가 발생했습니다.</p>';
        }
    }
});