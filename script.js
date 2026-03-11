const micBtn = document.getElementById('mic-btn');
const langBtns = document.querySelectorAll('.lang-btn');
const statusText = document.getElementById('status-text');
const sourceBox = document.getElementById('source-box');
const translationBox = document.getElementById('translation-box');
const sourceTag = document.getElementById('source-lang-tag');
const targetTag = document.getElementById('target-lang-tag');
const interpreterBtn = document.getElementById('interpreter-mode-btn');
const interpreterStatus = document.getElementById('interpreter-status');
const interpreterText = document.getElementById('interpreter-text');

// Language state
let currentLang = 'en';
let isInterpreterMode = false;
const langMap = {
    'en': { name: 'English', code: 'en-US', target: 'fi', voice: 'fi-FI' },
    'fi': { name: 'Finnish', code: 'fi-FI', target: 'fa', voice: 'fa-IR' },
    'fa': { name: 'Persian', code: 'fa-IR', target: 'fi', voice: 'fi-FI' }
};

let recognition;
let isListening = false;
const synth = window.speechSynthesis;

// TTS with auto-clear
function speak(text, langCode) {
    if (synth.speaking) synth.cancel();
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;
    utter.rate = 1.0;
    
    utter.onstart = () => {
        translationBox.parentElement.classList.add('speaking-glow');
    };
    utter.onend = () => {
        translationBox.parentElement.classList.remove('speaking-glow');
    };
    
    synth.speak(utter);
}

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        statusText.innerText = isInterpreterMode ? 'Interpreting Live' : 'Listening...';
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const transcript = finalTranscript || interimTranscript;
        if (transcript) {
            sourceBox.value = transcript;
            
            // Sentence-by-sentence logic
            if (finalTranscript || !isInterpreterMode) {
                processInterpretation(transcript);
            }
        }
    };

    recognition.onend = () => {
        if (isListening) recognition.start();
        else {
            micBtn.classList.remove('listening');
            statusText.innerText = 'Tap to start';
        }
    };
}

// Logic to process text (Auto-detect & Translate)
let debounceTimeout;
function processInterpretation(text) {
    if (!text.trim() || text === '...') return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        try {
            let sLang = currentLang;
            let tLang = langMap[currentLang].target;

            // Auto-detection logic for Interpreter Mode
            const langPair = isInterpreterMode ? `autodetect|fi` : `${sLang}|${tLang}`;
            
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`);
            const data = await response.json();
            
            if (data.responseData) {
                let translatedText = data.responseData.translatedText;
                
                // Smart Direction Switch for Finnish input
                if (isInterpreterMode && (text.toLowerCase().match(/[äöå]/) || data.matches.some(m => m.subject === "Finnish"))) {
                    // If input was Finnish, translate again to Persian
                    const reRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fi|fa`);
                    const reData = await reRes.json();
                    translatedText = reData.responseData.translatedText;
                    tLang = 'fa';
                } else if (isInterpreterMode) {
                    tLang = 'fi';
                }

                translationBox.innerText = translatedText;
                speak(translatedText, langMap[tLang].code);
            }
        } catch (e) { console.error(e); }
    }, 600);
}

// Mode & Manual Lang Switching
interpreterBtn.addEventListener('click', () => {
    isInterpreterMode = !isInterpreterMode;
    interpreterBtn.classList.toggle('active');
    interpreterStatus.classList.toggle('hidden');
    
    if (isInterpreterMode && !isListening) startListening();
});

langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isInterpreterMode) return;
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLang = btn.dataset.lang;
        updateUI();
    });
});

function updateUI() {
    const config = langMap[currentLang];
    sourceTag.innerText = `(${config.name})`;
    targetTag.innerText = `(${langMap[config.target].name})`;
    if (recognition) recognition.lang = config.code;
    sourceBox.style.direction = (currentLang === 'fa') ? 'rtl' : 'ltr';
    sourceBox.value = '';
    translationBox.innerText = '...';
}

micBtn.addEventListener('click', () => {
    if (isListening) stopListening();
    else startListening();
});

function startListening() { recognition.start(); isListening = true; }
function stopListening() { recognition.stop(); isListening = false; }

sourceBox.addEventListener('input', () => processInterpretation(sourceBox.value));
