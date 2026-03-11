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

// 🌸 Auto-Detection Heuristics
function detectLanguage(text) {
    const persianRegex = /[\u0600-\u06FF]/;
    const finnishRegex = /[äöåÄÖÅ]/;
    
    if (persianRegex.test(text)) return 'fa';
    if (finnishRegex.test(text)) return 'fi';
    return 'en'; // Default to English if no clear markers
}

// 🌸 Recognition Pivot (Smart Listening)
function pivotRecognition(lang) {
    if (!recognition || !isInterpreterMode) return;
    const targetCode = langMap[lang].code;
    
    if (recognition.lang !== targetCode) {
        console.log(`Pivoting listener to: ${targetCode}`);
        recognition.lang = targetCode;
        
        // Restart recognition to apply new language hint
        if (isListening) {
            recognition.stop();
            // recognition.onend will handle the restart
        }
    }
}

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        statusText.innerText = isInterpreterMode ? 'Truly Auto' : 'Listening...';
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
            
            // 🌸 Real-time Pivot Attempt (even on interim)
            if (isInterpreterMode && interimTranscript.length > 5) {
                const detected = detectLanguage(interimTranscript);
                if (detected !== 'en' && recognition.lang !== langMap[detected].code) {
                   // Only pivot if we are reasonably sure
                   // pivotRecognition(detected); 
                }
            }
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

// Truly Auto Logic
let debounceTimeout;
async function processInterpretation(text) {
    if (!text.trim() || text === '...') return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        try {
            let detected = detectLanguage(text);
            let sLang = isInterpreterMode ? detected : currentLang;
            let finalTarget = 'fi'; 

            // Logic: EN/FA -> FI, FI -> FA
            if (sLang === 'fi') finalTarget = 'fa';
            else finalTarget = 'fi';

            console.log(`Input Detected: ${sLang} -> Targeting: ${finalTarget}`);

            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sLang}|${finalTarget}`);
            const data = await response.json();
            
            if (data.responseData) {
                let translatedText = data.responseData.translatedText;
                translationBox.innerText = translatedText;
                speak(translatedText, langMap[finalTarget].code);
                
                if (isInterpreterMode) {
                    sourceTag.innerText = `Detected: ${langMap[sLang].name}`;
                    targetTag.innerText = `Target: ${langMap[finalTarget].name}`;
                    
                    // 🌸 Smart Pivot for NEXT sentence
                    // If we just spoke Finnish, we should listen for Finnish next (or English/Persian)
                    // The pivot is most important when switching from a Latin-based language to Persian
                    pivotRecognition(sLang); 
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
    manualLangs.classList.toggle('hidden');
    
    if (isInterpreterMode) {
        statusText.innerText = "Truly Auto Mode";
        sourceTag.innerText = "(Detecting...)";
        targetTag.innerText = "(Interpreting...)";
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

updateUI();
