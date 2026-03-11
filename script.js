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
    utter.onerror = (e) => console.error("TTS Error:", e);
    
    synth.speak(utter);
}

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        console.log("Recognition started");
        isListening = true;
        micBtn.classList.add('listening');
        statusText.innerText = isInterpreterMode ? 'Interpreting Live' : 'Listening...';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        statusText.innerText = 'Error: ' + event.error;
        if (event.error === 'not-allowed') {
            statusText.innerText = 'Microphone blocked';
        }
        stopListening();
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
            console.log("Transcript:", transcript);
            
            // Sentence-by-sentence logic - trigger on pauses (final results)
            if (finalTranscript || !isInterpreterMode) {
                processInterpretation(transcript);
            }
        }
    };

    recognition.onend = () => {
        console.log("Recognition ended");
        if (isListening) {
            try {
                recognition.start();
            } catch (e) {
                console.warn("Recognition restart failed, retrying...", e);
                setTimeout(() => isListening && recognition.start(), 500);
            }
        } else {
            micBtn.classList.remove('listening');
            statusText.innerText = 'Tap to start';
        }
    };
} else {
    statusText.innerText = 'Speech API not supported';
    micBtn.disabled = true;
}

// Logic to process text (Auto-detect & Translate)
let debounceTimeout;
function processInterpretation(text) {
    if (!text.trim() || text === '...') return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        try {
            console.log("Processing text for translation...");
            let sLang = currentLang;
            let tLang = langMap[currentLang].target;

            // In Interpreter Mode, we use 'autodetect' but MyMemory's 'autodetect' is mostly for source.
            // We want to detect if it's Finnish (FI) or (EN/FA)
            const langPair = isInterpreterMode ? `autodetect|fi` : `${sLang}|${tLang}`;
            
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`);
            const data = await response.json();
            
            if (data.responseData) {
                let translatedText = data.responseData.translatedText;
                let finalTarget = isInterpreterMode ? 'fi' : tLang;

                // Smart Heuristic for bi-directional Interpreter mode
                if (isInterpreterMode) {
                    // Check if input was already Finnish (so translation is redundant or same)
                    // Or if specific Finnish characters are present
                    const isFinnishInput = text.toLowerCase().match(/[äöå]/) || 
                                         (data.matches && data.matches.some(m => m.subject === "Finnish")) ||
                                         (translatedText.toLowerCase().trim() === text.toLowerCase().trim());

                    if (isFinnishInput) {
                        console.log("Detected Finnish input, translating to Persian...");
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
            translationBox.innerText = "Error: Connection issue";
        }
    }, 600);
}

// Mode & Manual Lang Switching
interpreterBtn.addEventListener('click', () => {
    isInterpreterMode = !isInterpreterMode;
    interpreterBtn.classList.toggle('active');
    interpreterStatus.classList.toggle('hidden');
    
    if (isInterpreterMode) {
        statusText.innerText = "Interpreter Mode Engaged";
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

if (speakBtn) {
    speakBtn.addEventListener('click', () => {
        const text = translationBox.innerText;
        if (text && text !== '...') {
            const tLang = isInterpreterMode ? (translationBox.innerText.match(/[آ-ی]/) ? 'fa' : 'fi') : langMap[currentLang].target;
            speak(text, langMap[tLang].code);
        }
    });
}

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

function startListening() { 
    if (!recognition) return;
    try {
        recognition.start(); 
        isListening = true; 
    } catch (e) {
        console.error("Failed to start recognition:", e);
    }
}

function stopListening() { 
    if (!recognition) return;
    recognition.stop(); 
    isListening = false; 
}

sourceBox.addEventListener('input', () => processInterpretation(sourceBox.value));

// Initial UI sync
updateUI();
