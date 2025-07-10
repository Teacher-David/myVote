// student-list.js
import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const pollListDiv = document.getElementById('poll-list');
    const loadingMessage = document.getElementById('loading-message');

    // 'active' 상태의 투표만 가져와 최신순으로 정렬
    const q = query(collection(db, "polls"), where("status", "==", "active"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        pollListDiv.innerHTML = ''; // 기존 목록 초기화
        if (snapshot.empty) {
            pollListDiv.innerHTML = '<p class="no-polls">현재 진행 중인 투표가 없습니다.</p>';
            loadingMessage.style.display = 'none'; // 로딩 메시지 숨김
            return;
        }

        loadingMessage.style.display = 'none'; // 로딩 메시지 숨김
        snapshot.forEach((doc) => {
            const poll = doc.data();
            const pollId = doc.id;

            const card = document.createElement('div');
            card.className = 'poll-card';
            card.innerHTML = `
                <h2>${poll.title}</h2>
                <p>마감: ${poll.endDate ? new Date(poll.endDate.toDate()).toLocaleString() : '미정'}</p>
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