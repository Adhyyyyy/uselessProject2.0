/**
 * Enhanced Voice Controller for Realistic Male Voice
 * Uses Web Speech API with intelligent voice selection
 * No API keys required - works completely offline
 */

export class VoiceController {
  constructor() {
    this.selectedVoice = null;
    this.isEnabled = true;
    this.isInitialized = false;
    this.voicesLoaded = false;
    this.setupVoices();
  }

  setupVoices() {
    // Check if voices are already available
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      this.selectBestMaleVoice();
      this.voicesLoaded = true;
      this.isInitialized = true;
    } else {
      // Wait for voices to load (some browsers load them asynchronously)
      speechSynthesis.addEventListener('voiceschanged', () => {
        if (!this.voicesLoaded) {
          this.selectBestMaleVoice();
          this.voicesLoaded = true;
          this.isInitialized = true;
          console.log('🎙️ Voice Controller initialized with voice:', this.selectedVoice?.name);
        }
      });
    }
  }

  selectBestMaleVoice() {
    const voices = speechSynthesis.getVoices();
    
    // Priority list for realistic male voices across different platforms
    const maleVoicePreferences = [
      // Windows voices (high quality)
      'Microsoft David - English (United States)',
      'Microsoft Mark - English (United States)', 
      'Microsoft David Desktop - English (United States)',
      'Microsoft Mark Desktop - English (United States)',
      
      // macOS voices (high quality)
      'Daniel',
      'Daniel (Enhanced)',
      'Alex',
      'Fred',
      
      // Chrome/Google voices
      'Google US English Male',
      'Chrome OS US English Male',
      
      // Android voices
      'English (United States) Male',
      'en-US-male',
      
      // Generic fallbacks
      'Male',
      'Man'
    ];

    // Try to find preferred voices in order
    for (const preferred of maleVoicePreferences) {
      const voice = voices.find(v => 
        v.name === preferred || 
        v.name.includes(preferred)
      );
      if (voice) {
        this.selectedVoice = voice;
        console.log('🎯 Selected preferred voice:', voice.name);
        return;
      }
    }

    // Advanced fallback: find any male voice
    this.selectedVoice = voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      
      return (
        lang.startsWith('en') && (
          name.includes('male') || 
          name.includes('man') || 
          name.includes('david') || 
          name.includes('daniel') || 
          name.includes('mark') || 
          name.includes('alex') || 
          name.includes('fred') ||
          name.includes('andrew') ||
          name.includes('brian') ||
          name.includes('christopher')
        )
      );
    });

    // Last resort: any English voice with lower pitch preference
    if (!this.selectedVoice) {
      this.selectedVoice = voices.find(v => 
        v.lang.startsWith('en-US') || v.lang.startsWith('en-GB')
      );
    }

    if (this.selectedVoice) {
      console.log('🔍 Selected fallback voice:', this.selectedVoice.name);
    } else {
      console.log('⚠️ No suitable voice found, using browser default');
    }
  }

  speak(text, options = {}) {
    if (!this.isEnabled || !text) return null;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply selected voice
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    // Enhanced voice settings for character personality
    const settings = this.getVoiceSettings(text, options);
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    // Add event listeners for better control
    utterance.onstart = () => {
      console.log('🎙️ Voice started:', text.substring(0, 30) + '...');
    };

    utterance.onend = () => {
      console.log('🔇 Voice finished');
    };

    utterance.onerror = (event) => {
      console.error('🚫 Voice error:', event.error);
    };

    try {
      speechSynthesis.speak(utterance);
      return utterance;
    } catch (error) {
      console.error('❌ Speech synthesis failed:', error);
      return null;
    }
  }

  getVoiceSettings(text, options = {}) {
    // Base settings for a realistic male character
    let settings = {
      rate: options.rate || 0.85,     // Slightly slower for clarity and character
      pitch: options.pitch || 0.75,  // Lower pitch for male voice
      volume: options.volume || 0.8   // Comfortable volume
    };

    // Adjust based on dialogue content for character personality
    const lowerText = text.toLowerCase();

    // Frustrated/angry tone
    if (lowerText.includes('ugh') || lowerText.includes('damn') || 
        lowerText.includes('!') || lowerText.includes('stupid') ||
        lowerText.includes('why') || lowerText.includes('again')) {
      settings.rate = 1.0;   // Faster when frustrated
      settings.pitch = 0.85; // Higher pitch when agitated
      settings.volume = 0.9; // Louder when upset
    }
    
    // Tired/defeated tone
    else if (lowerText.includes('tired') || lowerText.includes('give up') ||
             lowerText.includes('done') || lowerText.includes('...')) {
      settings.rate = 0.7;   // Slower when tired
      settings.pitch = 0.65; // Lower when defeated
      settings.volume = 0.7; // Quieter when exhausted
    }
    
    // Determined/hopeful tone
    else if (lowerText.includes('try') || lowerText.includes('again') ||
             lowerText.includes('can') || lowerText.includes('will')) {
      settings.rate = 0.9;   // Normal pace for determination
      settings.pitch = 0.8;  // Slightly higher for hope
      settings.volume = 0.85; // Clear and confident
    }
    
    // Confused/questioning tone
    else if (lowerText.includes('?') || lowerText.includes('how') ||
             lowerText.includes('what') || lowerText.includes('where')) {
      settings.rate = 0.8;   // Slower when thinking
      settings.pitch = 0.9;  // Higher at end for question
      settings.volume = 0.8; // Normal volume
    }

    return settings;
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled) {
      speechSynthesis.cancel(); // Stop current speech
    }
    console.log('🔊 Voice', this.isEnabled ? 'enabled' : 'disabled');
    return this.isEnabled;
  }

  stop() {
    speechSynthesis.cancel();
  }

  // Get available voices for debugging/selection
  getAvailableVoices() {
    return speechSynthesis.getVoices().map(voice => ({
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default
    }));
  }

  // Get current voice info
  getCurrentVoice() {
    return this.selectedVoice ? {
      name: this.selectedVoice.name,
      lang: this.selectedVoice.lang,
      localService: this.selectedVoice.localService
    } : null;
  }

  // Force voice refresh (useful if voices change)
  refreshVoices() {
    this.voicesLoaded = false;
    this.selectBestMaleVoice();
    this.voicesLoaded = true;
  }
}

// Export singleton instance for easy use across components
export const voiceController = new VoiceController();
