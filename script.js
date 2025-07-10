// 1. Firebase Configuration (REPLACE WITH YOUR ACTUAL CONFIG)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- DOM Elements ---
const votingForm = document.getElementById('votingForm');
const votingTopicsSection = document.querySelector('.voting-topics');
const submitButton = document.querySelector('.submit-button');

// --- Functions ---

/**
 * Renders voting topics fetched from Firestore.
 * @param {Array<Object>} topics - An array of topic objects from Firestore.
 */
async function renderVotingTopics(topics) {
    if (!votingTopicsSection) return;

    // Clear existing topics before rendering new ones
    votingTopicsSection.innerHTML = '<h2>투표 주제</h2>';

    if (topics.length === 0) {
        votingTopicsSection.innerHTML += '<p>현재 진행 중인 투표가 없습니다.</p>';
        return;
    }

    topics.sort((a, b) => a.order - b.order); // Sort by an 'order' field if you have one

    topics.forEach(topic => {
        const topicId = topic.id;
        const topicName = topic.name;
        const deadline = topic.deadline ? new Date(topic.deadline.seconds * 1000).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '날짜 미정'; // Convert Firestore Timestamp to readable date

        const topicCard = document.createElement('div');
        topicCard.classList.add('topic-card');

        topicCard.innerHTML = `
            <h3>${topicName}</h3>
            <div class="options">
                <label>
                    <input type="radio" name="topic_${topicId}" value="approve" required> 찬성
                </label>
                <label>
                    <input type="radio" name="topic_${topicId}" value="disapprove"> 반대
                </label>
            </div>
            <p class="deadline">마감일: ${deadline}</p>
        `;
        votingTopicsSection.appendChild(topicCard);
    });
}

/**
 * Fetches voting topics from Firestore.
 */
async function fetchVotingTopics() {
    try {
        const snapshot = await db.collection('topics')
                                .where('active', '==', true) // Only fetch active topics
                                .orderBy('deadline', 'asc') // Order by deadline, soonest first
                                .get();
        const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderVotingTopics(topics);
    } catch (error) {
        console.error("Error fetching voting topics:", error);
        alert("투표 주제를 불러오는 데 실패했습니다. 다시 시도해주세요.");
    }
}

/**
 * Handles the form submission (when a user casts their vote).
 * @param {Event} event - The submit event object.
 */
async function handleVoteSubmission(event) {
    event.preventDefault(); // Prevent default form submission

    if (!confirm('투표를 제출하시겠습니까? 한 번 제출된 투표는 수정할 수 없습니다.')) {
        return;
    }

    submitButton.disabled = true; // Disable button to prevent double submission
    submitButton.textContent = '제출 중...';

    const formData = new FormData(votingForm);
    const votes = {};
    let allTopicsVoted = true;

    // Iterate through form data to get selected options for each topic
    for (let [key, value] of formData.entries()) {
        if (key.startsWith('topic_')) {
            const topicId = key.split('_')[1];
            votes[topicId] = value; // 'approve' or 'disapprove'
        }
    }

    // Basic validation: Check if all topics have a vote
    const radioGroups = document.querySelectorAll('.topic-card .options');
    radioGroups.forEach(group => {
        const radios = group.querySelectorAll('input[type="radio"]');
        const selected = Array.from(radios).some(radio => radio.checked);
        if (!selected) {
            allTopicsVoted = false;
        }
    });

    if (!allTopicsVoted) {
        alert("모든 투표 항목에 선택해주세요.");
        submitButton.disabled = false;
        submitButton.textContent = '투표 제출';
        return;
    }

    // Prepare vote data for Firestore
    const voteData = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Firestore server timestamp
        // userId: firebase.auth().currentUser ? firebase.auth().currentUser.uid : null, // If using auth
        // userIp: 'USER_IP_ADDRESS', // You'd need a server-side function to get this securely
        votes: votes
    };

    try {
        await db.collection('votes').add(voteData);
        alert("투표가 성공적으로 제출되었습니다. 감사합니다!");
        votingForm.reset(); // Clear form after submission
        // Optionally, redirect to a thank you page or results page
        // window.location.href = '/thank-you.html';
    } catch (error) {
        console.error("Error submitting vote:", error);
        alert("투표 제출에 실패했습니다. 다시 시도해주세요.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '투표 제출';
    }
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display topics when the page loads
    fetchVotingTopics();

    // Attach submit listener to the form
    if (votingForm) {
        votingForm.addEventListener('submit', handleVoteSubmission);
    }
});

// --- Admin Section (Conceptual - this would ideally be on a separate, protected page) ---
// For adding/managing topics - usually implemented with Firebase Auth and specific admin roles.
// This is just a placeholder to show the concept of where topics would come from.
async function addSampleTopicForAdmin(name, deadline, order) {
    try {
        await db.collection('topics').add({
            name: name,
            deadline: firebase.firestore.Timestamp.fromDate(new Date(deadline)),
            active: true, // Mark as active
            order: order // For sorting
        });
        console.log(`Topic "${name}" added successfully.`);
        // Re-fetch topics to update the view immediately after adding
        fetchVotingTopics();
    } catch (error) {
        console.error("Error adding topic:", error);
    }
}

// You could call this from your admin panel's JS
// Example:
// addSampleTopicForAdmin("급식 메뉴 변경 찬반", "2025-07-15", 1);
// addSampleTopicForAdmin("체육대회 종목 선정", "2025-07-13", 2);
// addSampleTopicForAdmin("교복 디자인 선호도 조사", "2025-07-13", 3);