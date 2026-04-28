let score = 0;
let timeLeft = 0;
let timerInterval;
let questionsData = {};
let currentPoint = 0;
let isStarHope = false;
let userAnswerStorage = "";
let questionQueue = [];
let currentQuestionIndex = 0;
let availableQuestions = {};
let currentAudioTimer = null;
let botScore = 0;
let leaderboard = JSON.parse(localStorage.getItem('olympiaLeaderboard')) || [];
let playerProfiles = JSON.parse(localStorage.getItem('olympiaProfiles')) || {};

/* ===============================
   CẤU HÌNH GAME
================================= */
const LEVEL_CONFIG = {
    10: { seconds: 11, audio: new Audio('audio/10s stereo.mp3') },
    20: { seconds: 16, audio: new Audio('audio/15s monotrai.mp3') },
    30: { seconds: 26, audio: new Audio('audio/20s stereo.mp3') }
};

const PACKAGE_STRUCTURE = {
    40: [10, 10, 20],
    60: [10, 20, 30],
    80: [20, 30, 30]
};

const audioCorrect = new Audio('sounds/correct.mp3');
const audioWrong = new Audio('sounds/wrong.mp3');
const audioIntro = new Audio('sounds/intro_music.mp3');
const audioAudienceClap = new Audio('sounds/audience_clap.mp3');
const audioAudienceTension = new Audio('sounds/audience_tension.mp3');
const audioVictory = new Audio('sounds/victory.mp3');

/* ===============================
   LOAD QUESTIONS
================================= */
async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        questionsData = await response.json();
        resetAvailableQuestions();
    } catch (e) {
        console.error('Lỗi tải questions.json', e);
    }
}

function resetAvailableQuestions() {
    availableQuestions = JSON.parse(JSON.stringify(questionsData));
}

loadQuestions();

/* ===============================
   INTRO VIDEO
================================= */
const introContainer = document.getElementById('video-intro-container');
const introVideo = document.getElementById('intro-video');
const manualPlayBtn = document.getElementById('manual-play-btn');
const skipIntroBtn = document.getElementById('skip-intro-btn');

window.onload = function () {
    let playPromise = introVideo.play();

    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('Video intro đang phát');
            })
            .catch(() => {
                manualPlayBtn.classList.remove('hidden');
            });
    }
};

manualPlayBtn.onclick = function () {
    introVideo.play();
    manualPlayBtn.classList.add('hidden');
};

function endIntroAndShowStart() {
    introVideo.pause();
    introContainer.style.transition = 'opacity 1s';
    introContainer.style.opacity = '0';

    setTimeout(() => {
        introContainer.classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    }, 1000);
}

introVideo.onended = endIntroAndShowStart;
skipIntroBtn.onclick = endIntroAndShowStart;

/* ===============================
   START SCREEN → SETUP SCREEN
================================= */
document.getElementById('begin-btn').onclick = function () {
    new Audio('sounds/click.mp3').play();

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
};

/* ===============================
   SETUP → GAME
================================= */
document.getElementById('ready-btn').onclick = function () {
    const playerName = document.getElementById('player-name').value.trim();

    if (!playerName) {
        alert('Vui lòng nhập tên thí sinh');
        return;
    }

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    audioIntro.loop = true;
    audioIntro.play().catch(() => {});

    mcTalk('welcome');

    setTimeout(() => {
        mcTalk('choosePackage');
    }, 2500);
};

/* ===============================
   CHỌN GÓI CÂU HỎI
================================= */
function startPackage(totalPoints) {
    audioIntro.pause();
    audioIntro.currentTime = 0;

    mcTalk(`package${totalPoints}`);

    setTimeout(() => {
        mcTalk('success');
    }, 2200);

    setTimeout(() => {
        questionQueue = [];
        currentQuestionIndex = 0;

        PACKAGE_STRUCTURE[totalPoints].forEach(level => {
            const key = `muc_${level}`;

            if (!availableQuestions[key] || availableQuestions[key].length === 0) {
                availableQuestions[key] = JSON.parse(JSON.stringify(questionsData[key]));
            }

            const list = availableQuestions[key];
            const randomIndex = Math.floor(Math.random() * list.length);
            const selectedQ = list.splice(randomIndex, 1)[0];

            questionQueue.push({
                ...selectedQ,
                level: level
            });
        });

        loadNextQuestion();
    }, 2500);
}

/* ===============================
   LOAD CÂU HỎI
================================= */
function loadNextQuestion() {
    if (currentQuestionIndex >= questionQueue.length) {
        saveLeaderboard(score);
        playAudienceEffect('victory');
        mcTalk('finish', score);
        alert('Kết thúc gói câu hỏi! Tổng điểm: ' + score);
        showFinalLeaderboard();
        location.reload();
        return;
    }

    const q = questionQueue[currentQuestionIndex];

    if (currentQuestionIndex === questionQueue.length - 1) {
        mcTalk('finalQuestion');
    }
    currentPoint = q.level;
    userAnswerStorage = '';

    document.getElementById('question-text').innerText =
        `CÂU ${currentQuestionIndex + 1} (${currentPoint}đ): ${q.q}`;

    document.getElementById('question-box').dataset.answer = q.a.toLowerCase();

    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').disabled = false;
    document.getElementById('answer-input').focus();

    const timerBar = document.getElementById('timer-bar');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    timerBar.style.background = 'linear-gradient(90deg, var(--primary), var(--secondary))';

    document.getElementById('timer-seconds').innerText =
        (LEVEL_CONFIG[currentPoint].seconds - 1) + 's';

    speak(q.q, currentPoint);
}

/* ===============================
   AI ĐỌC CÂU HỎI
================================= */
function speak(text, level) {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'vi-VN';
    speech.rate = 0.6;
    speech.pitch = 1;
    speech.volume = 1;

    speech.onend = () => {
        currentAudioTimer = LEVEL_CONFIG[level].audio;
        currentAudioTimer.currentTime = 0;
        currentAudioTimer.play();
        startTimer(LEVEL_CONFIG[level].seconds);
    };

    window.speechSynthesis.speak(speech);
}

function mcTalk(type, extra = "") {
    const scripts = {
        welcome: "Xin chào và chào mừng bạn đến với phần thi Về Đích của Đường Lên Đỉnh Olympia.",
        choosePackage: "Bạn muốn lựa chọn gói câu hỏi bao nhiêu cho phần thi về đích của mình?",
        package40: "Bạn đã lựa chọn gói 40 điểm, một lựa chọn an toàn nhưng đầy chiến thuật.",
        package60: "Bạn đã lựa chọn gói 60 điểm, một lựa chọn cân bằng giữa bản lĩnh và tính toán.",
        package80: "Bạn đã lựa chọn gói 80 điểm, một lựa chọn đầy bản lĩnh và rất đáng chờ đợi.",
        success: "Chúc bạn thật bình tĩnh, tự tin và thành công trong phần thi này.",
        correct: "Chính xác! Một câu trả lời rất xuất sắc.",
        wrong: `Rất tiếc, đáp án chính xác là ${extra}.`,
        hurry: "Thời gian không còn nhiều, hãy thật nhanh.",
        finalQuestion: "Đây là câu hỏi cuối cùng. Hãy tập trung cao độ.",
        finish: `Phần thi đã kết thúc. Tổng số điểm bạn đạt được là ${extra} điểm.`
    };

    speakSimple(scripts[type] || extra);
}

function speakSimple(text) {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'vi-VN';
    speech.rate = 0.6;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);
}

/* ===============================
   TIMER
================================= */
function startTimer(seconds) {
    clearInterval(timerInterval);

    timeLeft = seconds;
    const timerBar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-seconds');

    timerBar.style.transition = 'width 1s linear';

    timerInterval = setInterval(() => {
        timeLeft--;

        if (timeLeft < 0) timeLeft = 0;

        timerText.innerText = timeLeft + 's';
        timerBar.style.width = (timeLeft / seconds) * 100 + '%';

        if (timeLeft <= 5) {
            if (timeLeft === 5) {
                mcTalk('hurry');
            }
            timerBar.style.background = 'var(--danger)';
        }

        if (timeLeft === 0) {
            clearInterval(timerInterval);
            processFinalResult();
        }
    }, 1000);
}

/* ===============================
   NỘP ĐÁP ÁN
================================= */
function submitAnswer() {
    userAnswerStorage = document.getElementById('answer-input')
        .value
        .trim()
        .toLowerCase();

    document.getElementById('answer-input').disabled = true;
    document.getElementById('question-text').innerText =
        'Đã ghi nhận đáp án. Chờ hết giờ...';
}

document.getElementById('submit-btn').onclick = submitAnswer;

document.getElementById('answer-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        submitAnswer();
    }
});

/* ===============================
   NGÔI SAO HY VỌNG
================================= */
document.getElementById('star-hope-btn').onclick = function () {
    isStarHope = !isStarHope;
    this.classList.toggle('star-active');
};

/* ===============================
   XỬ LÝ KẾT QUẢ
================================= */
function triggerCorrectEffect() {
    document.body.classList.add('correct-flash');
    setTimeout(() => {
        document.body.classList.remove('correct-flash');
    }, 800);
}

function triggerWrongEffect() {
    document.body.classList.add('wrong-shake');
    setTimeout(() => {
        document.body.classList.remove('wrong-shake');
    }, 600);
}

function updatePlayerProfile(finalScore) {
    const playerName = document.getElementById('player-name')?.value?.trim() || 'Người chơi';

    if (!playerProfiles[playerName]) {
        playerProfiles[playerName] = {
            name: playerName,
            avatar: 'default-avatar.png',
            rank: 'Rookie',
            totalGames: 0,
            bestScore: 0,
            top1Count: 0,
            achievements: [],
            history: []
        };
    }

    const profile = playerProfiles[playerName];
    profile.totalGames += 1;
    profile.bestScore = Math.max(profile.bestScore, finalScore);
    profile.history.push({
        score: finalScore,
        date: new Date().toLocaleDateString('vi-VN')
    });

    if (finalScore >= 80) profile.rank = 'Gold';
    if (finalScore >= 120) profile.rank = 'Master';
    if (finalScore >= 160) profile.rank = 'Olympia Legend';

    if (leaderboard.length === 0 || finalScore >= leaderboard[0].score) {
        profile.top1Count += 1;
    }

    if (finalScore >= 80 && !profile.achievements.includes('Full 80')) {
        profile.achievements.push('Full 80');
    }

    localStorage.setItem('olympiaProfiles', JSON.stringify(playerProfiles));
}

function saveLeaderboard(finalScore) {
    const playerName = document.getElementById('player-name')?.value?.trim() || 'Người chơi';

    updatePlayerProfile(finalScore);

    leaderboard.push({
        name: playerName,
        score: finalScore,
        date: new Date().toLocaleDateString('vi-VN')
    });

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);

    localStorage.setItem('olympiaLeaderboard', JSON.stringify(leaderboard));
}

function showFinalLeaderboard() {
    let text = '=== BẢNG XẾP HẠNG TOP 10 ===';

    leaderboard.forEach((player, index) => {
        text += `${index + 1}. ${player.name} - ${player.score} điểm (${player.date})
`;
    });

    alert(text || 'Chưa có dữ liệu leaderboard');
}

function playAudienceEffect(type) {
    if (type === 'correct') {
        audioAudienceClap.currentTime = 0;
        audioAudienceClap.play().catch(() => {});
    }

    if (type === 'wrong') {
        audioAudienceTension.currentTime = 0;
        audioAudienceTension.play().catch(() => {});
    }

    if (type === 'victory') {
        audioVictory.currentTime = 0;
        audioVictory.play().catch(() => {});
    }
}

function processFinalResult() {
    if (currentAudioTimer) {
        currentAudioTimer.pause();
    }

    const correctAns = document.getElementById('question-box').dataset.answer;

    if (userAnswerStorage === correctAns && correctAns !== '') {
        audioCorrect.play();
        playAudienceEffect('correct');
        triggerCorrectEffect();
        score += isStarHope ? currentPoint * 2 : currentPoint;
        mcTalk('correct');
        alert('CHÍNH XÁC!');
    } else {
        audioWrong.play();
        playAudienceEffect('wrong');
        triggerWrongEffect();

        if (isStarHope) {
            score -= currentPoint;
        }

        

        mcTalk('wrong', correctAns.toUpperCase());
        alert('SAI! Đáp án đúng: ' + correctAns.toUpperCase());
    }

    document.getElementById('score').innerText = 'SCORE: ' + score;

    isStarHope = false;
    document.getElementById('star-hope-btn').classList.remove('star-active');

    setTimeout(() => {
        currentQuestionIndex++;
        loadNextQuestion();
    }, 2000);
}

/* Placeholder tránh lỗi nếu HTML gọi */
function toggleGuide() {}
function toggleSettings() {}
