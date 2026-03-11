const micBtn = document.getElementById('mic-btn');
const langToggle = document.getElementById('lang-toggle');
const statusText = document.getElementById('status-text');
const transcriptBox = document.getElementById('transcript-box');
const translationBox = document.getElementById('translation-box');
const labelEn = document.getElementById('label-en');
const labelFi = document.getElementById('label-fi');
const sourceTag = document.getElementById('source-lang-tag');
const targetTag = document.getElementById('target-lang-tag');

// Language state: true = Finnish to English, false = English to Finnish
let isFiToEn = false;
let recognition;
let isListening = false;

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
            recognition.start(); // Keep listening for continuous feel
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
            // Debounce or only translate significant changes to reduce latency feel
            translateText(textToTranslate);
        }
    };
} else {
    statusText.innerText = 'Web Speech API not supported in this browser.';
    micBtn.disabled = true;
}

// Language Toggle Logic
langToggle.addEventListener('change', () => {
    isFiToEn = langToggle.checked;
    
    // Update UI Labels
    if (isFiToEn) {
        labelFi.classList.add('active');
        labelEn.classList.remove('active');
        sourceTag.innerText = '(Finnish)';
        targetTag.innerText = '(English)';
        if (recognition) recognition.lang = 'fi-FI';
    } else {
        labelEn.classList.add('active');
        labelFi.classList.remove('active');
        sourceTag.innerText = '(English)';
        targetTag.innerText = '(Finnish)';
        if (recognition) recognition.lang = 'en-US';
    }
    
    // Reset boxes
    transcriptBox.innerText = '...';
    translationBox.innerText = '...';
    
    // Restart recognition if it was active to apply new language
    if (isListening) {
        recognition.stop();
        setTimeout(() => recognition.start(), 300);
    }
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

// Translation Logic
let translationTimeout;
async function translateText(text) {
    if (!text.trim()) return;

    // Optional: Add a simple debounce to avoid too many API calls
    clearTimeout(translationTimeout);
    translationTimeout = setTimeout(async () => {
        const sourceLang = isFiToEn ? 'fi' : 'en';
        const targetLang = isFiToEn ? 'en' : 'fi';
        
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
            const data = await response.json();
            
            if (data.responseData) {
                translationBox.innerText = data.responseData.translatedText;
            }
        } catch (error) {
            console.error('Translation error:', error);
            translationBox.innerText = 'Translation error...';
        }
    }, 500); // 500ms debounce
}
