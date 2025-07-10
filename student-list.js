// student-list.js
import { db } from './firebase-config.js';
import { collection, query, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const pollListDiv = document.getElementById('poll-list');
    const loadingMessage = document.getElementById('loading-message');

    // 모든 투표를 가져와서 클라이언트에서 필터링 (인덱스 문제 완전 해결)
    const q = query(collection(db, "polls"));

    onSnapshot(q, (snapshot) => {
        pollListDiv.innerHTML = ''; // 기존 목록 초기화
        
        // 클라이언트에서 active 상태만 필터링
        const activePolls = [];
        snapshot.forEach((doc) => {
            const poll = doc.data();
            if (poll.status === 'active') {
                activePolls.push({ id: doc.id, ...poll });
            }
        });
        
        if (activePolls.length === 0) {
            pollListDiv.innerHTML = '<p class="no-polls">현재 진행 중인 투표가 없습니다.</p>';
            loadingMessage.style.display = 'none'; // 로딩 메시지 숨김
            return;
        }

        loadingMessage.style.display = 'none'; // 로딩 메시지 숨김
        
        // 투표 목록 표시
        activePolls.forEach((poll) => {
            const pollId = poll.id;
            
            const card = document.createElement('div');
            card.className = 'poll-card';
            card.innerHTML = `
                <h2>${poll.title}</h2>
                <p>마감: ${poll.endDate ? new Date(poll.endDate.toDate()).toLocaleString() : '미정'}</p>
                <p>생성자: ${poll.createdByName || '알 수 없음'}</p>
            `;
            card.addEventListener('click', () => {
                window.location.href = `vote.html?pollId=${pollId}`;
            });
            pollListDiv.appendChild(card);
        });
    }, (error) => {
        console.error("Error fetching polls: ", error);
        pollListDiv.innerHTML = '<p class="no-polls" style="color: red;">투표 목록을 불러오는 데 오류가 발생했습니다.</p>';
        loadingMessage.style.display = 'none';
    });
});