// Quiz State
let allQuestions = []; // Tüm sorular
let questions = []; // Filtrelenmiş sorular
let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let answeredQuestions = new Set();
let userAnswers = {};
let isReviewMode = false;
let currentSource = 'all'; // Seçili kaynak
let sources = {}; // Kaynak listesi ve soru sayıları

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

// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('open');
}

// Load questions from API
async function loadQuestions() {
    try {
        const response = await fetch('/api/questions');
        allQuestions = await response.json();
        questions = [...allQuestions];
        totalQuestionsEl.textContent = questions.length;
        
        // Kaynakları çıkar ve listele
        extractSources();
        renderSourcesList();
    } catch (error) {
        console.error('Sorular yüklenirken hata:', error);
    }
}

// Kaynakları çıkar
function extractSources() {
    sources = {};
    allQuestions.forEach(q => {
        const cat = q.category || 'Diğer';
        if (!sources[cat]) {
            sources[cat] = 0;
        }
        sources[cat]++;
    });
}

// Kaynak listesini render et
function renderSourcesList() {
    const sourcesList = document.getElementById('sources-list');
    const countAll = document.getElementById('count-all');
    
    if (!sourcesList) return;
    
    // Toplam sayıyı güncelle
    countAll.textContent = allQuestions.length;
    
    // Kaynak emojileri
    const sourceIcons = {
        'FP': '🧠',
        'Python': '🐍',
        'Flask': '🌶️',
        'HTML': '🌐',
        'ML': '🤖',
        'AI': '🤖',
        'DL': '📊',
        'NN': '🔗',
        'Diğer': '📚'
    };
    
    sourcesList.innerHTML = '<div class="sources-divider">Kategoriler</div>';
    
    // Kategorileri sırala ve listele
    Object.keys(sources).sort().forEach(cat => {
        const icon = sourceIcons[cat] || '📖';
        const isActive = currentSource === cat;
        
        sourcesList.innerHTML += `
            <div class="source-item ${isActive ? 'active' : ''}" data-source="${cat}" onclick="selectSource('${cat}')">
                <span class="source-icon">${icon}</span>
                <span class="source-name">${cat}</span>
                <span class="source-count">${sources[cat]}</span>
            </div>
        `;
    });
}

// Kaynak seç
function selectSource(source) {
    currentSource = source;
    
    // UI'ı güncelle
    document.querySelectorAll('.source-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.source === source) {
            item.classList.add('active');
        }
    });
    
    // Soruları filtrele
    if (source === 'all') {
        // Karışık mod - soruları karıştır
        questions = shuffleArray([...allQuestions]);
    } else {
        questions = allQuestions.filter(q => (q.category || 'Diğer') === source);
    }
    
    // Toplam sayıyı güncelle
    totalQuestionsEl.textContent = questions.length;
    
    // Quiz'i sıfırla
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    answeredQuestions.clear();
    userAnswers = {};
    updateStats();
    
    // Start screen'e dön
    showScreen('start');
    
    // Start card'daki sayıyı güncelle
    const startCard = document.querySelector('.start-card p strong');
    if (startCard) {
        startCard.textContent = questions.length;
    }
    
    // Mobile'da sidebar'ı kapat
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
    }
}

// Diziyi karıştır (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Start Quiz
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

// Display current question
function displayQuestion() {
    const question = questions[currentQuestionIndex];
    
    // Soru kodu ve numarasını göster
    const codeDisplay = question.code ? `${question.code}` : `Soru ${currentQuestionIndex + 1}`;
    questionNumberEl.textContent = codeDisplay;
    currentQuestionEl.textContent = currentQuestionIndex + 1;
    questionTextEl.textContent = question.question;
    
    // Kategoriyi göster
    const categoryEl = document.getElementById('q-category');
    if (categoryEl) {
        categoryEl.textContent = question.category || '';
    }
    
    // Update progress bar
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    
    // Clear and create options
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    
    question.options.forEach((option, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option';
        optionEl.innerHTML = `
            <span class="option-letter">${letters[index]}</span>
            <span class="option-text">${option}</span>
        `;
        
        // Her zaman tıklanabilir yap (cevap değiştirme için)
        optionEl.addEventListener('click', () => selectOption(index));
        
        // Eğer daha önce cevaplandıysa stilleri uygula
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
    
    // Show/hide explanation if already answered
    if (answeredQuestions.has(question.id)) {
        const userAnswer = userAnswers[question.id];
        showExplanation(userAnswer.explanation, userAnswer.isCorrect);
        nextBtn.disabled = false;
    } else {
        hideExplanation();
        nextBtn.disabled = true;
    }
    
    // Update navigation buttons
    prevBtn.disabled = currentQuestionIndex === 0;
    
    // Update next button text on last question
    if (currentQuestionIndex === questions.length - 1 && answeredQuestions.size === questions.length) {
        nextBtn.innerHTML = `
            <span>Sonuçlar</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    } else {
        nextBtn.innerHTML = `
            <span>Sonraki</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
}

// Select option
async function selectOption(index) {
    const question = questions[currentQuestionIndex];
    
    // Eğer daha önce cevaplanmışsa, cevabı değiştir
    if (answeredQuestions.has(question.id)) {
        // Eski cevabı geri al
        const oldAnswer = userAnswers[question.id];
        if (oldAnswer.isCorrect) {
            correctCount--;
        } else {
            wrongCount--;
        }
        answeredQuestions.delete(question.id);
        delete userAnswers[question.id];
    }
    
    // Mark as answered
    answeredQuestions.add(question.id);
    
    // Check answer via API
    try {
        const response = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: question.id,
                answer: index
            })
        });
        
        const result = await response.json();
        
        // Store user answer
        userAnswers[question.id] = {
            userAnswer: index,
            correctAnswer: result.correct_answer,
            isCorrect: result.correct,
            explanation: result.explanation
        };
        
        // Update counts
        if (result.correct) {
            correctCount++;
        } else {
            wrongCount++;
        }
        updateStats();
        
        // Update UI
        const options = optionsContainer.querySelectorAll('.option');
        options.forEach((opt, i) => {
            opt.classList.add('disabled');
            
            if (i === index) {
                opt.classList.add(result.correct ? 'correct' : 'wrong');
            }
            if (i === result.correct_answer && !result.correct) {
                opt.classList.add('correct');
            }
        });
        
        // Show explanation
        showExplanation(result.explanation, result.correct);
        
        // Enable next button
        nextBtn.disabled = false;
        
    } catch (error) {
        console.error('Cevap kontrol edilirken hata:', error);
    }
}

// Show explanation
function showExplanation(text, isCorrect) {
    explanationBox.classList.add('visible');
    explanationBox.classList.remove('correct', 'wrong');
    explanationBox.classList.add(isCorrect ? 'correct' : 'wrong');
    
    explanationIcon.textContent = isCorrect ? '✓' : '✗';
    explanationTitle.textContent = isCorrect ? 'Doğru!' : 'Yanlış!';
    explanationText.textContent = text;
}

// Hide explanation
function hideExplanation() {
    explanationBox.classList.remove('visible');
}

// Navigate to previous question
function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

// Navigate to next question
function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else if (answeredQuestions.size === questions.length) {
        showResults();
    }
}

// Update stats display
function updateStats() {
    correctCountEl.textContent = correctCount;
    wrongCountEl.textContent = wrongCount;
}

// Show results
function showResults() {
    showScreen('results');
    
    const percentage = Math.round((correctCount / questions.length) * 100);
    
    document.getElementById('final-correct').textContent = correctCount;
    document.getElementById('final-wrong').textContent = wrongCount;
    document.getElementById('final-percentage').textContent = `${percentage}%`;
    
    // Set appropriate icon and message
    const resultsIcon = document.getElementById('results-icon');
    const resultsMessage = document.getElementById('results-message');
    
    if (percentage >= 90) {
        resultsIcon.textContent = '🏆';
        resultsMessage.textContent = 'Mükemmel! Sınava çok iyi hazırsın!';
    } else if (percentage >= 70) {
        resultsIcon.textContent = '🎉';
        resultsMessage.textContent = 'Harika! Biraz daha çalışmayla tam hazır olacaksın.';
    } else if (percentage >= 50) {
        resultsIcon.textContent = '💪';
        resultsMessage.textContent = 'İyi gidiyorsun, ama daha fazla pratik yapmalısın.';
    } else {
        resultsIcon.textContent = '📚';
        resultsMessage.textContent = 'Konuları tekrar gözden geçirmeni öneririm.';
    }
}

// Review quiz
function reviewQuiz() {
    isReviewMode = true;
    currentQuestionIndex = 0;
    showScreen('quiz');
    displayQuestion();
}

// Restart quiz
function restartQuiz() {
    startQuiz();
}

// Show screen helper
function showScreen(screen) {
    startScreen.classList.remove('active');
    quizScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    
    switch(screen) {
        case 'start':
            startScreen.classList.add('active');
            break;
        case 'quiz':
            quizScreen.classList.add('active');
            break;
        case 'results':
            resultsScreen.classList.add('active');
            break;
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!quizScreen.classList.contains('active')) return;
    
    const question = questions[currentQuestionIndex];
    
    switch(e.key) {
        case '1':
        case 'a':
        case 'A':
            if (!answeredQuestions.has(question.id)) selectOption(0);
            break;
        case '2':
        case 'b':
        case 'B':
            if (!answeredQuestions.has(question.id)) selectOption(1);
            break;
        case '3':
        case 'c':
        case 'C':
            if (!answeredQuestions.has(question.id)) selectOption(2);
            break;
        case '4':
        case 'd':
        case 'D':
            if (!answeredQuestions.has(question.id)) selectOption(3);
            break;
        case 'ArrowLeft':
            if (!prevBtn.disabled) prevQuestion();
            break;
        case 'ArrowRight':
        case 'Enter':
            if (!nextBtn.disabled) nextQuestion();
            break;
    }
});
