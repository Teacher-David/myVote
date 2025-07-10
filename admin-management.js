// admin-management.js
import { db, auth, functions } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, getDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

// Chart.js 전역 변수
let resultsChart = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 확인
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log('User logged in:', user.uid, user.email);
            initializeAdminPanel();
        } else {
            console.log('User not logged in, redirecting to login page');
            window.location.href = 'admin-login.html';
        }
    });

    function initializeAdminPanel() {
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
        const voterListEl = document.getElementById('voter-list');

        let editingPollId = null; // 수정 중인 투표 ID

        // 사용자 정보 표시
        const userInfoEl = document.createElement('div');
        userInfoEl.style.cssText = 'margin-bottom: 10px; color: #666; font-size: 0.9em;';
        userInfoEl.textContent = `로그인: ${currentUser.email}`;
        document.querySelector('.header-controls h1').after(userInfoEl);

        // 로그아웃 버튼 이벤트
        logoutBtn.addEventListener('click', async () => {
            if (confirm('정말 로그아웃하시겠습니까?')) {
                try {
                    await signOut(auth);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('로그아웃 오류:', error);
                    alert('로그아웃 중 오류가 발생했습니다.');
                }
            }
        });

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
                    // 투표 수정 (현재 사용자의 투표만 수정 가능)
                    const pollRef = doc(db, 'polls', editingPollId);
                    const pollSnap = await getDoc(pollRef);
                    
                    if (pollSnap.exists() && pollSnap.data().createdBy === currentUser.uid) {
                        await updateDoc(pollRef, {
                            title: title,
                            endDate: endDate,
                            updatedAt: new Date()
                        });
                        alert('투표가 수정되었습니다.');
                    } else {
                        alert('수정 권한이 없습니다.');
                        return;
                    }
                } else {
                    // 새 투표 생성 (현재 사용자 정보 포함)
                    console.log('Creating new poll with data:', { title, endDate, options });
                    
                    const newPollRef = await addDoc(collection(db, 'polls'), {
                        title: title,
                        status: 'active',
                        endDate: endDate,
                        createdAt: new Date(),
                        createdBy: currentUser.uid, // 생성자 UID
                        createdByEmail: currentUser.email, // 생성자 이메일
                        createdByName: currentUser.displayName || currentUser.email // 생성자 이름
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

        // 투표 목록 실시간 업데이트 (현재 사용자의 투표만)
        // 임시 해결책: orderBy를 제거하고 클라이언트에서 정렬
        const pollsQuery = query(
            collection(db, 'polls'), 
            where('createdBy', '==', currentUser.uid)
        );
        
        onSnapshot(pollsQuery, (snapshot) => {
            pollTableBody.innerHTML = '';
            if (snapshot.empty) {
                pollTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">생성된 투표가 없습니다.</td></tr>';
                return;
            }

            // 클라이언트에서 정렬
            const polls = [];
            snapshot.forEach((doc) => {
                polls.push({ id: doc.id, ...doc.data() });
            });
            
            // 생성일 기준 내림차순 정렬
            polls.sort((a, b) => {
                const aDate = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const bDate = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return bDate - aDate;
            });

            // 테이블에 추가
            polls.forEach((poll) => {
                const pollId = poll.id;
                const row = pollTableBody.insertRow();

                row.insertCell(0).textContent = poll.title;
                const statusCell = row.insertCell(1);
                statusCell.innerHTML = `
                    <button class="status-toggle ${poll.status}" data-poll-id="${pollId}" data-current-status="${poll.status}">
                        ${poll.status === 'active' ? '진행 중' : '종료됨'}
                    </button>
                `;
                row.insertCell(2).textContent = poll.endDate ? new Date(poll.endDate.toDate()).toLocaleString() : '없음';
                row.insertCell(3).textContent = poll.createdAt ? new Date(poll.createdAt.toDate()).toLocaleString() : '알 수 없음';

                const actionsCell = row.insertCell(4);
                actionsCell.innerHTML = `
                    <div class="action-buttons">
                        <button class="view-btn" data-poll-id="${pollId}">결과보기</button>
                        <button class="edit-btn" data-poll-id="${pollId}">수정</button>
                        <button class="delete-btn" data-poll-id="${pollId}">삭제</button>
                    </div>
                `;
            });
        });

        // 투표 테이블 클릭 이벤트 (이벤트 위임 사용)
        document.querySelector('#poll-table').addEventListener('click', async (e) => {
            const pollId = e.target.dataset.pollId;
            if (!pollId) return;

            // 투표 상태 토글
            if (e.target.classList.contains('status-toggle')) {
                const currentStatus = e.target.dataset.currentStatus;
                const newStatus = currentStatus === 'active' ? 'ended' : 'active';
                
                try {
                    await updateDoc(doc(db, 'polls', pollId), {
                        status: newStatus
                    });
                } catch (error) {
                    console.error("Error updating poll status: ", error);
                    alert('투표 상태 변경 중 오류가 발생했습니다.');
                }
            }

            // 투표 삭제
            if (e.target.classList.contains('delete-btn')) {
                if (confirm('정말 이 투표를 삭제하시겠습니까? 모든 투표 결과도 함께 삭제됩니다.')) {
                    try {
                        // 권한 체크
                        const pollRef = doc(db, 'polls', pollId);
                        const pollSnap = await getDoc(pollRef);
                        
                        if (!pollSnap.exists() || pollSnap.data().createdBy !== currentUser.uid) {
                            alert('삭제 권한이 없습니다.');
                            return;
                        }

                        // 서브컬렉션 삭제
                        const optionsQuery = query(collection(db, 'polls', pollId, 'options'));
                        const optionsSnapshot = await getDocs(optionsQuery);
                        
                        const batch = writeBatch(db);
                        optionsSnapshot.forEach((doc) => {
                            batch.delete(doc.ref);
                        });
                        
                        // 투표 문서 삭제
                        batch.delete(pollRef);
                        await batch.commit();
                        
                        alert('투표가 삭제되었습니다.');
                    } catch (error) {
                        console.error("Error deleting poll: ", error);
                        alert('투표 삭제 중 오류가 발생했습니다.');
                    }
                }
            }

            // 결과 보기
            if (e.target.classList.contains('view-btn')) {
                try {
                    // 권한 체크
                    const pollRef = doc(db, 'polls', pollId);
                    const pollSnap = await getDoc(pollRef);
                    
                    if (!pollSnap.exists() || pollSnap.data().createdBy !== currentUser.uid) {
                        alert('결과 보기 권한이 없습니다.');
                        return;
                    }

                    const poll = pollSnap.data();
                    resultsPollTitle.textContent = poll.title;
                    
                    // 옵션과 투표 수 가져오기
                    const optionsSnapshot = await getDocs(collection(db, 'polls', pollId, 'options'));
                    const options = [];
                    const voteCounts = [];
                    
                    optionsSnapshot.forEach((doc) => {
                        const option = doc.data();
                        options.push(option.optionName);
                        voteCounts.push(option.voteCount || 0);
                    });
                    
                    // 차트 생성/업데이트
                    const ctx = document.getElementById('results-chart').getContext('2d');
                    if (resultsChart) {
                        resultsChart.destroy();
                    }
                    
                    resultsChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: options,
                            datasets: [{
                                label: '투표 수',
                                data: voteCounts,
                                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                }
                            }
                        }
                    });
                    
                    // 투표자 목록 가져오기
                    const votesQuery = query(collection(db, 'votes'), where('pollId', '==', pollId));
                    const votesSnapshot = await getDocs(votesQuery);
                    
                    const voterList = [];
                    votesSnapshot.forEach((doc) => {
                        const vote = doc.data();
                        voterList.push(`${vote.studentId} - ${vote.selectedOption} (${new Date(vote.votedAt.toDate()).toLocaleString()})`);
                    });
                    
                    voterListEl.innerHTML = voterList.length > 0 ? 
                        `<ul>${voterList.map(voter => `<li>${voter}</li>`).join('')}</ul>` : 
                        '<p>아직 투표한 학생이 없습니다.</p>';
                    
                    resultsModal.style.display = 'block';
                } catch (error) {
                    console.error("Error fetching poll results: ", error);
                    alert('결과를 불러오는 중 오류가 발생했습니다.');
                }
            }

            // 투표 수정
            if (e.target.classList.contains('edit-btn')) {
                try {
                    // 권한 체크
                    const pollRef = doc(db, 'polls', pollId);
                    const pollSnap = await getDoc(pollRef);
                    
                    if (!pollSnap.exists() || pollSnap.data().createdBy !== currentUser.uid) {
                        alert('수정 권한이 없습니다.');
                        return;
                    }

                    const poll = pollSnap.data();
                    
                    editingPollId = pollId;
                    modalTitle.textContent = '투표 수정';
                    pollTitleInput.value = poll.title;
                    endDateInput.value = poll.endDate ? new Date(poll.endDate.toDate()).toISOString().slice(0, 16) : '';
                    
                    // 기존 옵션 로드
                    const optionsSnapshot = await getDocs(collection(db, 'polls', pollId, 'options'));
                    optionsFormContainer.innerHTML = '';
                    
                    optionsSnapshot.forEach((doc) => {
                        const option = doc.data();
                        const div = document.createElement('div');
                        div.className = 'option-input-group';
                        div.innerHTML = `
                            <input type="text" class="option-input" value="${option.optionName}" required>
                            <button type="button" class="remove-option-btn">삭제</button>
                        `;
                        optionsFormContainer.appendChild(div);
                    });
                    
                    createEditModal.style.display = 'block';
                } catch (error) {
                    console.error("Error loading poll for editing: ", error);
                    alert('투표 정보를 불러오는 중 오류가 발생했습니다.');
                }
            }
        });
    }
});
