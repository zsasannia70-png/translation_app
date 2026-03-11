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
const speakBtn = document.getElementById('speak-btn');

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

// To track already processed sentences
let lastProcessedIndex = -1;

// TTS with auto-clear
function speak(text, langCode) {
    if (!text || !langCode) return;
    if (synth.speaking) synth.cancel();
    
    console.log(`Speaking: "${text}" in ${langCode}`);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;
    utter.rate = 1.0;
    
    utter.onstart = () => {
        translationBox.parentElement.classList.add('speaking-glow');
        if (speakBtn) speakBtn.classList.add('speaking');
    };
    utter.onend = () => {
        translationBox.parentElement.classList.remove('speaking-glow');
        if (speakBtn) speakBtn.classList.remove('speaking');
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
        statusText.innerText = isInterpreterMode ? 'Interpreter Active' : 'Listening...';
        lastProcessedIndex = -1; // Reset index on new session
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        // We only process the NEW final result to avoid repetition
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                // If this is a new final index we haven't processed yet
                if (i > lastProcessedIndex) {
                    console.log("New Final Sentence:", transcript);
                    sourceBox.value = transcript; // Only show the current sentence to avoid clutter
                    processInterpretation(transcript);
                    lastProcessedIndex = i;
                }
            } else {
                interimTranscript += transcript;
            }
        }

        // Show interim text for feedback
        if (interimTranscript) {
            sourceBox.value = interimTranscript;
        }
    };

    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        statusText.innerText = 'Error: ' + event.error;
        stopListening();
    };

    recognition.onend = () => {
        if (isListening) {
            try {
                recognition.start();
            } catch (e) {
                setTimeout(() => isListening && recognition.start(), 500);
            }
        } else {
            micBtn.classList.remove('listening');
            statusText.innerText = 'Tap to start';
        }
    };
}

// Logic to process text
let debounceTimeout;
function processInterpretation(text) {
    if (!text.trim() || text === '...') return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        try {
            let sLang = currentLang;
            let tLang = langMap[currentLang].target;

            const langPair = isInterpreterMode ? `autodetect|fi` : `${sLang}|${tLang}`;
            
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`);
            const data = await response.json();
            
            if (data.responseData) {
                let translatedText = data.responseData.translatedText;
                let finalTarget = isInterpreterMode ? 'fi' : tLang;

                if (isInterpreterMode) {
                    const isFinnishInput = text.toLowerCase().match(/[äöå]/) || 
                                         (data.matches && data.matches.some(m => m.subject === "Finnish")) ||
                                         (translatedText.toLowerCase().trim() === text.toLowerCase().trim());

                    if (isFinnishInput) {
                        const reRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fi|fa`);
                        const reData = await reRes.json();
                        translatedText = reData.responseData.translatedText;
                        finalTarget = 'fa';
                    }
                }

                translationBox.innerText = translatedText;
                speak(translatedText, langMap[finalTarget].code);
            }
        } catch (e) { 
            console.error("Translation Error:", e);
        }
    }, 400); // Faster response
}

// UI Handlers
interpreterBtn.addEventListener('click', () => {
    isInterpreterMode = !isInterpreterMode;
    interpreterBtn.classList.toggle('active');
    interpreterStatus.classList.toggle('hidden');
    
    if (isInterpreterMode) {
        statusText.innerText = "Engaged";
        if (!isListening) startListening();
    } else {
        updateUI();
    }
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

micBtn.addEventListener('click', () => {
    if (isListening) stopListening();
    else startListening();
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

function startListening() { recognition.start(); isListening = true; }
function stopListening() { recognition.stop(); isListening = false; }

sourceBox.addEventListener('input', () => processInterpretation(sourceBox.value));

updateUI();
