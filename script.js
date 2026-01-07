// Quiz State
let allQuestions = [];
let questions = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let answeredQuestions = new Set();
let userAnswers = {};
let isReviewMode = false;
let currentSource = 'all';
let sources = {};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const progressBar = document.getElementById('progress-bar');
const correctCountEl = document.getElementById('correct-count');
const wrongCountEl = document.getElementById('wrong-count');
const currentQuestionEl = document.getElementById('current-question');
const totalQuestionsEl = document.getElementById('total-questions');
const questionNumberEl = document.getElementById('q-number');
const questionTextEl = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const explanationBox = document.getElementById('explanation-box');
const explanationText = document.getElementById('explanation-text');
const explanationIcon = document.getElementById('explanation-icon');
const explanationTitle = document.getElementById('explanation-title');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggle-icon');
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
        toggleIcon.innerHTML = '<path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    } else {
        toggleIcon.innerHTML = '<path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    }
}

async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        allQuestions = await response.json();
        questions = [...allQuestions];
        totalQuestionsEl.textContent = questions.length;
        extractSources();
        renderSourcesList();
    } catch (error) {
        console.error('Error loading questions:', error);
    }
}

function extractSources() {
    sources = {};
    allQuestions.forEach(q => {
        const cat = q.category || 'Other';
        if (!sources[cat]) sources[cat] = 0;
        sources[cat]++;
    });
}

function renderSourcesList() {
    const sourcesList = document.getElementById('sources-list');
    const countAll = document.getElementById('count-all');
    if (!sourcesList) return;
    countAll.textContent = allQuestions.length;
    
    // Separate KAAN and PDF categories
    const kaanCats = Object.keys(sources).filter(c => c === 'KAAN');
    const pdfCats = Object.keys(sources).filter(c => c.startsWith('PDF')).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0]) || 0;
        const numB = parseInt(b.match(/\d+/)?.[0]) || 0;
        return numB - numA;
    });
    
    sourcesList.innerHTML = '';
    
    // KAAN section
    if (kaanCats.length > 0) {
        sourcesList.innerHTML += '<div class="sources-divider">KAAN</div>';
        kaanCats.forEach(cat => {
            const isActive = currentSource === cat;
            sourcesList.innerHTML += `
                <div class="source-item ${isActive ? 'active' : ''}" data-source="${cat}" onclick="selectSource('${cat}')">
                    <span class="source-name">${cat}</span>
                    <span class="source-count">${sources[cat]}</span>
                </div>
            `;
        });
    }
    
    // PDFs section
    sourcesList.innerHTML += '<div class="sources-divider">PDFs</div>';
    pdfCats.forEach(cat => {
        const isActive = currentSource === cat;
        sourcesList.innerHTML += `
            <div class="source-item ${isActive ? 'active' : ''}" data-source="${cat}" onclick="selectSource('${cat}')">
                <span class="source-name">${cat}</span>
                <span class="source-count">${sources[cat]}</span>
            </div>
        `;
    });
}

function selectSource(source) {
    currentSource = source;
    document.querySelectorAll('.source-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.source === source) item.classList.add('active');
    });
    if (source === 'all') {
        questions = shuffleArray([...allQuestions]);
    } else {
        questions = allQuestions.filter(q => (q.category || 'Other') === source);
    }
    totalQuestionsEl.textContent = questions.length;
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    answeredQuestions.clear();
    userAnswers = {};
    updateStats();
    showScreen('start');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startQuiz() {
    showScreen('quiz');
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    answeredQuestions.clear();
    userAnswers = {};
    isReviewMode = false;
    updateStats();
    displayQuestion();
}

function displayQuestion() {
    const question = questions[currentQuestionIndex];
    let codeDisplay = `Q${currentQuestionIndex + 1}`;
    if (question.code) {
        const codeMatch = question.code.match(/SN(\d+)-(\d+)/i);
        if (codeMatch) {
            codeDisplay = `PDF ${codeMatch[1]} / Q${codeMatch[2]}`;
        } else {
            codeDisplay = question.code;
        }
    }
    questionNumberEl.textContent = codeDisplay;
    currentQuestionEl.textContent = currentQuestionIndex + 1;
    questionTextEl.textContent = question.question;
    
    const categoryEl = document.getElementById('q-category');
    if (categoryEl) {
        let categoryText = question.category || '';
        if (question.fp_tag) {
            const fpDisplay = question.fp_tag === 'FP' ? 'From PDF' : question.fp_tag;
            categoryText += (categoryText ? ' • ' : '') + fpDisplay;
        }
        categoryEl.textContent = categoryText;
    }
    
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    
    question.options.forEach((option, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option';
        optionEl.innerHTML = `
            <span class="option-letter">${letters[index]}</span>
            <span class="option-text">${option}</span>
        `;
        optionEl.addEventListener('click', () => selectOption(index));
        if (answeredQuestions.has(question.id)) {
            const userAnswer = userAnswers[question.id];
            if (index === userAnswer.userAnswer) {
                optionEl.classList.add(userAnswer.isCorrect ? 'correct' : 'wrong');
            }
            if (index === userAnswer.correctAnswer && !userAnswer.isCorrect) {
                optionEl.classList.add('correct');
            }
        }
        optionsContainer.appendChild(optionEl);
    });
    
    if (answeredQuestions.has(question.id)) {
        const userAnswer = userAnswers[question.id];
        showExplanation(userAnswer.explanation, userAnswer.isCorrect);
        nextBtn.disabled = false;
    } else {
        hideExplanation();
        nextBtn.disabled = true;
    }
    
    prevBtn.disabled = currentQuestionIndex === 0;
    updateNextButtonText();
}

function updateNextButtonText() {
    if (currentQuestionIndex === questions.length - 1 && answeredQuestions.size === questions.length) {
        nextBtn.innerHTML = `<span>Results</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else {
        nextBtn.innerHTML = `<span>Next</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
}

function selectOption(index) {
    const question = questions[currentQuestionIndex];
    
    if (answeredQuestions.has(question.id)) {
        const oldAnswer = userAnswers[question.id];
        if (oldAnswer.isCorrect) correctCount--;
        else wrongCount--;
        answeredQuestions.delete(question.id);
        delete userAnswers[question.id];
    }
    
    answeredQuestions.add(question.id);
    const isCorrect = index === question.correct;
    const explanation = `Correct answer: ${String.fromCharCode(65 + question.correct)}`;
    
    userAnswers[question.id] = {
        userAnswer: index,
        correctAnswer: question.correct,
        isCorrect: isCorrect,
        explanation: explanation
    };
    
    if (isCorrect) correctCount++;
    else wrongCount++;
    updateStats();
    
    const options = optionsContainer.querySelectorAll('.option');
    options.forEach((opt, i) => {
        opt.classList.add('disabled');
        if (i === index) opt.classList.add(isCorrect ? 'correct' : 'wrong');
        if (i === question.correct && !isCorrect) opt.classList.add('correct');
    });
    
    showExplanation(explanation, isCorrect);
    nextBtn.disabled = false;
    updateNextButtonText();
}

function showExplanation(text, isCorrect) {
    explanationBox.classList.add('visible');
    explanationBox.classList.remove('correct', 'wrong');
    explanationBox.classList.add(isCorrect ? 'correct' : 'wrong');
    explanationIcon.textContent = isCorrect ? '✓' : '✗';
    explanationTitle.textContent = isCorrect ? 'Correct!' : 'Wrong!';
    explanationText.textContent = text;
}

function hideExplanation() {
    explanationBox.classList.remove('visible');
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else if (answeredQuestions.size === questions.length) {
        showResults();
    }
}

function updateStats() {
    correctCountEl.textContent = correctCount;
    wrongCountEl.textContent = wrongCount;
}

function showResults() {
    showScreen('results');
    const percentage = Math.round((correctCount / questions.length) * 100);
    document.getElementById('final-correct').textContent = correctCount;
    document.getElementById('final-wrong').textContent = wrongCount;
    document.getElementById('final-percentage').textContent = `${percentage}%`;
    
    const resultsIcon = document.getElementById('results-icon');
    const resultsMessage = document.getElementById('results-message');
    
    if (percentage >= 90) {
        resultsIcon.textContent = '🏆';
        resultsMessage.textContent = 'Excellent! You are very well prepared for the exam!';
    } else if (percentage >= 70) {
        resultsIcon.textContent = '🎉';
        resultsMessage.textContent = "Great! With a little more practice, you'll be fully ready.";
    } else if (percentage >= 50) {
        resultsIcon.textContent = '💪';
        resultsMessage.textContent = 'Good progress, but you need more practice.';
    } else {
        resultsIcon.textContent = '📚';
        resultsMessage.textContent = 'I recommend reviewing the topics again.';
    }
}

function reviewQuiz() {
    isReviewMode = true;
    currentQuestionIndex = 0;
    showScreen('quiz');
    displayQuestion();
}

function restartQuiz() {
    startQuiz();
}

function showScreen(screen) {
    startScreen.classList.remove('active');
    quizScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    switch(screen) {
        case 'start': startScreen.classList.add('active'); break;
        case 'quiz': quizScreen.classList.add('active'); break;
        case 'results': resultsScreen.classList.add('active'); break;
    }
}

document.addEventListener('keydown', (e) => {
    if (!quizScreen.classList.contains('active')) return;
    const question = questions[currentQuestionIndex];
    switch(e.key) {
        case '1': case 'a': case 'A': if (!answeredQuestions.has(question.id)) selectOption(0); break;
        case '2': case 'b': case 'B': if (!answeredQuestions.has(question.id)) selectOption(1); break;
        case '3': case 'c': case 'C': if (!answeredQuestions.has(question.id)) selectOption(2); break;
        case '4': case 'd': case 'D': if (!answeredQuestions.has(question.id)) selectOption(3); break;
        case 'ArrowLeft': if (!prevBtn.disabled) prevQuestion(); break;
        case 'ArrowRight': case 'Enter': if (!nextBtn.disabled) nextQuestion(); break;
    }
});
