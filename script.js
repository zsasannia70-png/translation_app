const micBtn = document.getElementById('mic-btn');
const langBtns = document.querySelectorAll('.lang-btn');
const statusText = document.getElementById('status-text');
const transcriptBox = document.getElementById('transcript-box');
const translationBox = document.getElementById('translation-box');
const sourceTag = document.getElementById('source-lang-tag');
const targetTag = document.getElementById('target-lang-tag');
const webcam = document.getElementById('webcam');
const subtitleOverlay = document.getElementById('subtitle-overlay');

// Language state
let currentLang = 'en';
const langMap = {
    'en': { name: 'English', code: 'en-US', target: 'fi' },
    'fi': { name: 'Finnish', code: 'fi-FI', target: 'en' },
    'fa': { name: 'Persian', code: 'fa-IR', target: 'fi' }
};

let recognition;
let isListening = false;
let stream;

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
            subtitleOverlay.innerText = textToTranslate;
            translateText(textToTranslate);
        }
    };
} else {
    statusText.innerText = 'Web Speech API not supported in this browser.';
    micBtn.disabled = true;
}

// Language Picker Logic
langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentLang = btn.dataset.lang;
        const config = langMap[currentLang];
        
        sourceTag.innerText = `(${config.name})`;
        targetTag.innerText = `(${langMap[config.target].name})`;
        
        if (recognition) {
            recognition.lang = config.code;
            // Apply RTL for Farsi display
            transcriptBox.style.direction = (currentLang === 'fa') ? 'rtl' : 'ltr';
            subtitleOverlay.style.direction = (currentLang === 'fa') ? 'rtl' : 'ltr';
        }
        
        // Reset boxes
        transcriptBox.innerText = '...';
        translationBox.innerText = '...';
        
        if (isListening) {
            recognition.stop();
            setTimeout(() => recognition.start(), 300);
        }
    });
});

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
    subtitleOverlay.innerText = text;
    translateText(text);
});

// Translation Logic
let translationTimeout;
async function translateText(text) {
    if (!text.trim()) return;

    clearTimeout(translationTimeout);
    translationTimeout = setTimeout(async () => {
        const config = langMap[currentLang];
        const sourceLang = currentLang;
        const targetLang = config.target;
        
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
            const data = await response.json();
            
            if (data.responseData) {
                const translated = data.responseData.translatedText;
                translationBox.innerText = translated;
                
                // Show translation as subtitle with correct direction
                subtitleOverlay.innerText = translated;
                subtitleOverlay.style.direction = (targetLang === 'fa') ? 'rtl' : 'ltr';
            }
        } catch (error) {
            console.error('Translation error:', error);
            translationBox.innerText = 'Translation error...';
        }
    }, 500);
}
