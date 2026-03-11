const micBtn = document.getElementById('mic-btn');
const langBtns = document.querySelectorAll('.lang-btn');
const statusText = document.getElementById('status-text');
const transcriptBox = document.getElementById('transcript-box');
const translationBox = document.getElementById('translation-box');
const sourceTag = document.getElementById('source-lang-tag');
const targetTag = document.getElementById('target-lang-tag');
const webcam = document.getElementById('webcam');
const subtitleOverlay = document.getElementById('subtitle-overlay');
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
let stream;

// TTS Setup
const synth = window.speechSynthesis;

function speak(text, langCode) {
    if (synth.speaking) synth.cancel();
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    
    utter.onstart = () => {
        transcriptBox.parentElement.classList.add('speaking-glow');
        if (isInterpreterMode) interpreterText.innerText = "Speaking translation...";
    };
    utter.onend = () => {
        transcriptBox.parentElement.classList.remove('speaking-glow');
        if (isInterpreterMode) interpreterText.innerText = "Interpreter Active";
    };
    
    synth.speak(utter);
}

async function initWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcam.srcObject = stream;
    } catch (err) {
        console.error("Webcam error:", err);
    }
}

initWebcam();

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        statusText.innerText = 'Listening... Tap to stop';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        statusText.innerText = 'Error: ' + event.error;
        stopListening();
    };

    recognition.onend = () => {
        if (isListening) {
            recognition.start();
        } else {
            micBtn.classList.remove('listening');
            statusText.innerText = 'Tap to start listening';
        }
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const textToTranslate = finalTranscript || interimTranscript;
        if (textToTranslate) {
            transcriptBox.innerText = textToTranslate;
            subtitleOverlay.innerText = ''; // Clear old subtitles immediately
            
            // Only translate/speak when we have a "final" sentence feel (or in manual mode)
            if (finalTranscript || !isInterpreterMode) {
                translateAndInterpret(textToTranslate);
            }
        }
    };
} else {
    statusText.innerText = 'Web Speech API not supported in this browser.';
    micBtn.disabled = true;
}

// Interpreter Mode Logic
interpreterBtn.addEventListener('click', () => {
    isInterpreterMode = !isInterpreterMode;
    interpreterBtn.classList.toggle('active', isInterpreterMode);
    interpreterStatus.classList.toggle('hidden', !isInterpreterMode);
    
    if (isInterpreterMode) {
        statusText.innerText = "Interpreter Mode Engaged";
        if (!isListening) startListening();
    }
});

// Language Picker Logic
langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isInterpreterMode) return; // Disable manual switch during interpreter mode
        
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentLang = btn.dataset.lang;
        updateUIForLang();
        
        if (isListening) {
            recognition.stop();
            setTimeout(() => recognition.start(), 300);
        }
    });
});

function updateUIForLang() {
    const config = langMap[currentLang];
    sourceTag.innerText = `(${config.name})`;
    targetTag.innerText = `(${langMap[config.target].name})`;
    
    if (recognition) {
        recognition.lang = config.code;
        transcriptBox.style.direction = (currentLang === 'fa') ? 'rtl' : 'ltr';
        subtitleOverlay.style.direction = (currentLang === 'fa') ? 'rtl' : 'ltr';
    }
    
    transcriptBox.innerText = '...';
    translationBox.innerText = '...';
}

// Set default language
if (recognition) recognition.lang = 'en-US';

// Microphone Toggle
micBtn.addEventListener('click', () => {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
});

function startListening() {
    isListening = true;
    recognition.start();
}

function stopListening() {
    isListening = false;
    recognition.stop();
}

// Manual Text Input Logic
transcriptBox.addEventListener('input', () => {
    const text = transcriptBox.innerText;
    subtitleOverlay.innerText = ''; 
    translateAndInterpret(text);
});

// Advanced Translation & Interpreter Logic
let translationTimeout;
async function translateAndInterpret(text) {
    if (!text.trim() || text === '...') return;

    clearTimeout(translationTimeout);
    translationTimeout = setTimeout(async () => {
        try {
            // If in Interpreter Mode, try to detect language first
            let sourceLang = currentLang;
            let targetLang = langMap[currentLang].target;

            // MyMemory handles autodetection if we use 'autodetect'
            const apiLangPair = isInterpreterMode ? `autodetect|fi` : `${sourceLang}|${targetLang}`;
            
            let response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${apiLangPair}`);
            let data = await response.json();
            
            if (data.responseData) {
                let detectedLang = data.matches[0].usage_count > 0 ? data.matches[0].segment.split('|')[0] : 'en'; 
                // Note: MyMemory response structure can vary, but we can also infer from data.responseData.translatedText
                
                // If we detected Finnish but was targeting Finnish, switch to Persian
                if (isInterpreterMode) {
                    const matchesDetection = data.matches.find(m => m.id); // Simple heuristic
                    // If the result looks like it was already Finnish or the API says so
                    if (data.matches.some(m => m.subject === "Finnish" || text.toLowerCase().includes("terve"))) {
                         // Likely Finnish input
                         targetLang = 'fa';
                         sourceLang = 'fi';
                         // Re-fetch for Persian
                         response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fi|fa`);
                         data = await response.json();
                    } else {
                         // Likely EN or FA input -> already translated to FI
                         targetLang = 'fi';
                    }
                }

                const translated = data.responseData.translatedText;
                translationBox.innerText = translated;
                subtitleOverlay.innerText = translated;
                subtitleOverlay.style.direction = (targetLang === 'fa') ? 'rtl' : 'ltr';

                // Automatically Read Aloud
                if (isInterpreterMode || true) { // User rule #6: Do not require button press
                    speak(translated, langMap[targetLang === 'fa' ? 'fa' : 'fi'].code);
                }
            }
        } catch (error) {
            console.error('Interpreter Error:', error);
        }
    }, 800);
}
