class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.source = null;
    this.gainNode = null;
    this.boostGainNode = null;
    this.eqFilters = {};
    this.isInitialized = false;
    this.currentVolume = 1;
    this.isBoosted = false;
  }

  // Инициализация аудиоконтекста
  init(audioElement) {
    if (this.isInitialized) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Создаём основной узел усиления
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.currentVolume;
      
      // Создаём узел для буста (отдельно)
      this.boostGainNode = this.audioContext.createGain();
      this.boostGainNode.gain.value = 1.0;
      
      // Создаём источник из аудиоэлемента
      this.source = this.audioContext.createMediaElementSource(audioElement);
      
      // Создаём фильтры для эквалайзера
      this.createEqFilters();
      
      // Подключаем цепочку: источник -> эквалайзер -> усиление -> буст -> вывод
      this.connectChain();
      
      this.isInitialized = true;
      console.log('AudioProcessor: Инициализирован');
      
      // Загружаем сохраненные настройки
      this.loadSettings();
    } catch (error) {
      console.error('AudioProcessor: Ошибка инициализации:', error);
    }
  }

  // Создание фильтров эквалайзера
  createEqFilters() {
    // Частоты для 5-полосного эквалайзера
    const frequencies = [
      { name: '60hz', freq: 60 },
      { name: '230hz', freq: 230 },
      { name: '910hz', freq: 910 },
      { name: '3.6khz', freq: 3600 },
      { name: '14khz', freq: 14000 }
    ];

    frequencies.forEach(({ name, freq }) => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      this.eqFilters[name] = filter;
    });

    // Басы (низкие частоты) - полочный фильтр
    this.eqFilters['bass'] = this.audioContext.createBiquadFilter();
    this.eqFilters['bass'].type = 'lowshelf';
    this.eqFilters['bass'].frequency.value = 250;
    this.eqFilters['bass'].Q.value = 0.7;
    this.eqFilters['bass'].gain.value = 0;

    // Высокие частоты - полочный фильтр
    this.eqFilters['treble'] = this.audioContext.createBiquadFilter();
    this.eqFilters['treble'].type = 'highshelf';
    this.eqFilters['treble'].frequency.value = 3000;
    this.eqFilters['treble'].Q.value = 0.7;
    this.eqFilters['treble'].gain.value = 0;
  }

  // Подключение цепочки обработки
  connectChain() {
    if (!this.source || !this.audioContext) return;

    let currentNode = this.source;
    
    // Подключаем все фильтры эквалайзера последовательно
    const allFilters = [
      this.eqFilters['60hz'],
      this.eqFilters['230hz'],
      this.eqFilters['910hz'],
      this.eqFilters['3.6khz'],
      this.eqFilters['14khz'],
      this.eqFilters['bass'],
      this.eqFilters['treble'],
      this.gainNode,
      this.boostGainNode
    ];

    allFilters.forEach((filter) => {
      if (filter) {
        currentNode.connect(filter);
        currentNode = filter;
      }
    });

    // Подключаем к выходу
    currentNode.connect(this.audioContext.destination);
  }

  // Установка усиления громкости (буст)
  setBoost(enabled, volume) {
    if (!this.boostGainNode) return;
    
    this.currentVolume = volume;
    this.isBoosted = enabled;
    
    // Основная громкость (0-100%)
    this.gainNode.gain.value = volume;
    
    // Буст (умножаем на 2 если включен)
    const boostMultiplier = enabled ? 2.0 : 1.0;
    this.boostGainNode.gain.value = boostMultiplier;
    
    console.log(`AudioProcessor: Буст ${enabled ? 'ВКЛ' : 'ВЫКЛ'}, Громкость: ${Math.round(volume * 100)}%`);
    
    this.saveSettings();
  }

  // Обновление настроек эквалайзера
  updateEqualizer(settings) {
    if (!this.audioContext) return;
    
    // Применяем настройки для каждой полосы
    Object.keys(settings).forEach(key => {
      if (this.eqFilters[key]) {
        const value = settings[key];
        
        // Конвертируем dB в gain (децибелы в коэффициент усиления)
        const gainValue = this.dBToGain(value);
        
        // Плавное изменение
        const now = this.audioContext.currentTime;
        this.eqFilters[key].gain.cancelScheduledValues(now);
        this.eqFilters[key].gain.setValueAtTime(this.eqFilters[key].gain.value, now);
        this.eqFilters[key].gain.linearRampToValueAtTime(gainValue, now + 0.1);
        
        console.log(`AudioProcessor: EQ ${key} = ${value}dB`);
      }
    });
    
    this.saveSettings();
  }

  // Конвертация dB в gain (коэффициент усиления)
  dBToGain(dB) {
    return Math.pow(10, dB / 20);
  }

  // Сброс эквалайзера
  resetEqualizer() {
    const defaultSettings = {
      '60hz': 0, '230hz': 0, '910hz': 0, '3.6khz': 0, '14khz': 0,
      'bass': 0, 'treble': 0
    };
    this.updateEqualizer(defaultSettings);
  }

  // Сохранение настроек в localStorage
  saveSettings() {
    try {
      // Преобразуем gain обратно в dB для хранения
      const getDbValue = (gain) => {
        return Math.round(20 * Math.log10(gain));
      };
      
      const settings = {
        boosted: this.isBoosted,
        volume: this.currentVolume,
        equalizer: {
          '60hz': getDbValue(this.eqFilters['60hz']?.gain.value || 1),
          '230hz': getDbValue(this.eqFilters['230hz']?.gain.value || 1),
          '910hz': getDbValue(this.eqFilters['910hz']?.gain.value || 1),
          '3.6khz': getDbValue(this.eqFilters['3.6khz']?.gain.value || 1),
          '14khz': getDbValue(this.eqFilters['14khz']?.gain.value || 1),
          'bass': getDbValue(this.eqFilters['bass']?.gain.value || 1),
          'treble': getDbValue(this.eqFilters['treble']?.gain.value || 1),
        },
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('audioSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('AudioProcessor: Ошибка сохранения настроек:', error);
    }
  }

  // Загрузка настроек из localStorage
  loadSettings() {
    try {
      const saved = localStorage.getItem('audioSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        
        if (settings.volume !== undefined) {
          this.currentVolume = settings.volume;
          this.gainNode.gain.value = settings.volume;
        }
        
        if (settings.boosted !== undefined) {
          this.isBoosted = settings.boosted;
          this.boostGainNode.gain.value = settings.boosted ? 2.0 : 1.0;
        }
        
        if (settings.equalizer) {
          Object.keys(settings.equalizer).forEach(key => {
            if (this.eqFilters[key]) {
              const dbValue = settings.equalizer[key];
              const gainValue = this.dBToGain(dbValue);
              this.eqFilters[key].gain.value = gainValue;
            }
          });
        }
        
        console.log('AudioProcessor: Настройки загружены из localStorage');
      }
    } catch (error) {
      console.error('AudioProcessor: Ошибка загрузки настроек:', error);
    }
  }

  // Остановка обработки
  disconnect() {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.isInitialized = false;
  }
}

// Экспортируем синглтон
export default new AudioProcessor();