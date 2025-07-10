// student-list.js
import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const pollListDiv = document.getElementById('poll-list');
    const loadingMessage = document.getElementById('loading-message');

    // 'active' 상태의 투표만 가져오기 (orderBy 제거하여 인덱스 문제 해결)
    const q = query(collection(db, "polls"), where("status", "==", "active"));

    onSnapshot(q, (snapshot) => {
        pollListDiv.innerHTML = ''; // 기존 목록 초기화
        if (snapshot.empty) {
            pollListDiv.innerHTML = '<p class="no-polls">현재 진행 중인 투표가 없습니다.</p>';
            loadingMessage.style.display = 'none'; // 로딩 메시지 숨김
            return;
        }

        loadingMessage.style.display = 'none'; // 로딩 메시지 숨김
        
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

        // 정렬된 투표 목록 표시
        polls.forEach((poll) => {
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