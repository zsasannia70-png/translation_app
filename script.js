const micBtn = document.getElementById('mic-btn');
const langBtns = document.querySelectorAll('.lang-btn');
const manualLangs = document.getElementById('manual-langs');
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
let lastProcessedIndex = -1;

// TTS with auto-clear
function speak(text, langCode) {
    if (!text || !langCode) return;
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
        lastProcessedIndex = -1;
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                if (i > lastProcessedIndex) {
                    sourceBox.value = transcript;
                    processInterpretation(transcript);
                    lastProcessedIndex = i;
                }
            } else {
                interimTranscript += transcript;
            }
        }

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

// Truly Auto Detection Logic
let debounceTimeout;
async function processInterpretation(text) {
    if (!text.trim() || text === '...') return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        try {
            // In Truly Auto mode, we let MyMemory detect the language
            // By default, we assume it's English/Persian to Finnish
            let langPair = isInterpreterMode ? `autodetect|fi` : `${currentLang}|${langMap[currentLang].target}`;
            
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`);
            const data = await response.json();
            
            if (data.responseData) {
                let translatedText = data.responseData.translatedText;
                let finalTarget = 'fi'; 

                // Bi-directional heuristic (Fixed)
                if (isInterpreterMode) {
                    // Check if input was actually Finnish
                    const isFinnishInput = text.toLowerCase().match(/[äöå]/) || 
                                         (data.matches && data.matches.some(m => m.subject === "Finnish")) ||
                                         (translatedText.toLowerCase().trim() === text.toLowerCase().trim());

                    if (isFinnishInput) {
                        // Switch to Persian output
                        const reRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fi|fa`);
                        const reData = await reRes.json();
                        translatedText = reData.responseData.translatedText;
                        finalTarget = 'fa';
                        
                        // Smart Auto-Hint: Update future listening to FI
                        if (recognition) recognition.lang = 'fi-FI';
                    } else {
                        // Smart Auto-Hint: Update future listening to EN or FA based on detected
                        // (Usually stays EN-US as it's the broadest for "non-FI")
                        if (text.match(/[آ-ی]/)) recognition.lang = 'fa-IR';
                        else recognition.lang = 'en-US';
                    }
                }

                translationBox.innerText = translatedText;
                speak(translatedText, langMap[finalTarget].code);
                
                // Update Tags dynamically
                if (isInterpreterMode) {
                    sourceTag.innerText = `(Auto-Detected)`;
                    targetTag.innerText = `(${langMap[finalTarget].name})`;
                }
            }
        } catch (e) { console.error(e); }
    }, 400);
}

// UI Mode Toggle
interpreterBtn.addEventListener('click', () => {
    isInterpreterMode = !isInterpreterMode;
    interpreterBtn.classList.toggle('active');
    interpreterStatus.classList.toggle('hidden');
    manualLangs.classList.toggle('hidden'); // Hide manual buttons
    
    if (isInterpreterMode) {
        statusText.innerText = "Truly Auto Mode";
        sourceTag.innerText = "(Auto-Detection On)";
        targetTag.innerText = "(Smart Output)";
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
    manualLangs.classList.remove('hidden');
}

function startListening() { recognition.start(); isListening = true; }
function stopListening() { recognition.stop(); isListening = false; }

sourceBox.addEventListener('input', () => processInterpretation(sourceBox.value));

// Init UI
updateUI();
