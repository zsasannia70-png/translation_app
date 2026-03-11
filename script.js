const micBtn = document.getElementById('mic-btn');
const langBtns = document.querySelectorAll('.lang-btn');
const statusText = document.getElementById('status-text');
const englishBox = document.getElementById('english-box');
const persianBox = document.getElementById('persian-box');
const translationBox = document.getElementById('translation-box');
const targetTag = document.getElementById('target-lang-tag');
const webcam = document.getElementById('webcam');
const subtitleOverlay = document.getElementById('subtitle-overlay');
const speakBtn = document.getElementById('speak-btn');

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
            if (currentLang === 'fa') {
                persianBox.value = textToTranslate;
            } else {
                englishBox.value = textToTranslate;
            }
            subtitleOverlay.innerText = ''; 
            translateText(textToTranslate, currentLang);
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
        
        targetTag.innerText = `(${langMap[config.target].name})`;
        
        if (recognition) {
            recognition.lang = config.code;
        }
        
        // Reset boxes
        englishBox.value = '';
        persianBox.value = '';
        translationBox.innerText = '...';
        
        if (isListening) {
            recognition.stop();
            setTimeout(() => recognition.start(), 300);
        }
    });
});

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
englishBox.addEventListener('input', () => {
    translateText(englishBox.value, 'en');
});

persianBox.addEventListener('input', () => {
    translateText(persianBox.value, 'fa');
});

// Finnish Pronunciation logic
speakBtn.addEventListener('click', () => {
    const text = translationBox.innerText;
    if (text && text !== '...' && text !== 'Translating...' && text !== 'Translation error...') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fi-FI';
        window.speechSynthesis.speak(utterance);
        
        // Visual feedback
        speakBtn.classList.add('speaking');
        utterance.onend = () => speakBtn.classList.remove('speaking');
    }
});

// Translation Logic
let translationTimeout;
async function translateText(text, sourceLang) {
    if (!text.trim()) {
        translationBox.innerText = '...';
        subtitleOverlay.innerText = '';
        return;
    }

    translationBox.innerText = 'Translating...';

    clearTimeout(translationTimeout);
    translationTimeout = setTimeout(async () => {
        // Force target to Finnish as per request
        const targetLang = 'fi';
        
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
            const data = await response.json();
            
            if (data.responseData) {
                const translated = data.responseData.translatedText;
                translationBox.innerText = translated;
                subtitleOverlay.innerText = translated;
                subtitleOverlay.style.direction = 'ltr'; // Finnish is LTR
            }
        } catch (error) {
            console.error('Translation error:', error);
            translationBox.innerText = 'Translation error...';
        }
    }, 500);
}
