# SoniTranslate | Voice-to-Text Translator

SoniTranslate is a modern, real-time voice translator specifically designed for low-latency translation between English and Finnish. It features a sleek glassmorphism interface and leverages powerful browser-native APIs for a seamless user experience.

**🌐 [Live Demo](https://zsasannia70-png.github.io/translation_app/)**

## ✨ Features

- **Live Voice Input**: Real-time transcription using the Web Speech API.
- **Bi-directional Translation**: Easily toggle between **English -> Finnish** and **Finnish -> English**.
- **Zero Latency Feel**: Optimized for immediate feedback with live transcript display.
- **Premium UI**: 
    - Dark mode by default.
    - Animated background blobs for a dynamic feel.
    - Responsive glassmorphism container.
    - Interactive microphone pulse animations.

## 🛠️ Technology Stack

- **HTML5/CSS3**: Semantic structure and advanced styling (Gradients, Glassmorphism).
- **JavaScript (Vanilla)**: Core logic for speech recognition and API interaction.
- **Web Speech API (`webkitSpeechRecognition`)**: Handles the audio stream and voice-to-text conversion locally in the browser.
- **MyMemory API**: Provides high-quality translations without requiring complex backend setup.

## 🚀 Getting Started

### Prerequisites

- A modern browser that supports the Web Speech API (Google Chrome or Microsoft Edge recommended).
- Microphone access.
- Active internet connection for translations.

### How to Run

1. **Option A (Simple)**: Just open the `index.html` file directly in your browser.
2. **Option B (Recommended)**: Serve the files using a local server to avoid potential `file://` protocol restrictions.
   ```bash
   npx serve .
   ```

## 🎮 Usage

1. **Start Listening**: Click the glowing purple microphone button. Grant microphone permissions if prompted.
2. **Speak**: Start talking! Your words will appear in the "Original" box immediately.
3. **Translation**: The translated text will appear in the "Translated" box after you finish speaking a phrase.
4. **Switch Languages**: Flip the toggle switch at the top to change the translation direction (EN-FI or FI-EN).
5. **Stop**: Tap the microphone button again (it will turn green while active and pulse).

## 📄 License

This project is created for educational purposes as part of the "AI in Practice" lessons.
