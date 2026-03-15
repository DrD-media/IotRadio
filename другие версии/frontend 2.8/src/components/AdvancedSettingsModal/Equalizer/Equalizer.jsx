// frontend/src/components/AdvancedSettingsModal/Equalizer/Equalizer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../Icon/Icon';
import './Equalizer.css';

// Простой эквалайзер без внешних библиотек
// Сохраняет настройки и симулирует работу
// Реальная обработка будет добавлена позже

const Equalizer = () => {
  // Состояния для полос эквалайзера
  const [bands, setBands] = useState([
    { id: 1, freq: 60, gain: 0, label: '60 Гц', type: 'Суб-бас', color: '#667eea' },
    { id: 2, freq: 230, gain: 0, label: '230 Гц', type: 'Низкие', color: '#764ba2' },
    { id: 3, freq: 910, gain: 0, label: '910 Гц', type: 'Средние', color: '#ff6b6b' },
    { id: 4, freq: 3600, gain: 0, label: '3.6 кГц', type: 'В. средние', color: '#4CAF50' },
    { id: 5, freq: 14000, gain: 0, label: '14 кГц', type: 'Высокие', color: '#FF9800' }
  ]);
  
  const [bass, setBass] = useState(0);
  const [treble, setTreble] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [audioSource, setAudioSource] = useState(null);
  const [filters, setFilters] = useState([]);

  // Реф для текущего аудио элемента
  const currentAudioRef = useRef(null);

  // Сохранение настроек
  const saveSettings = useCallback((eqBands, bassValue, trebleValue) => {
    const settings = {
      equalizer: {
        bands: eqBands,
        bass: bassValue,
        treble: trebleValue,
        isActive: isActive,
        lastUpdated: new Date().toISOString()
      }
    };
    localStorage.setItem('audioSettings', JSON.stringify(settings));
  }, [isActive]);

  // Пресеты
  const getPresets = useCallback(() => ({
    'Плоский': { 
      bands: bands.map(b => ({ ...b, gain: 0 })), 
      bass: 0, 
      treble: 0 
    },
    'Басы+': { 
      bands: [
        { ...bands[0], gain: 8 },
        { ...bands[1], gain: 6 },
        { ...bands[2], gain: 0 },
        { ...bands[3], gain: 0 },
        { ...bands[4], gain: 0 }
      ], 
      bass: 6, 
      treble: 0 
    },
    'Ясность': { 
      bands: [
        { ...bands[0], gain: 0 },
        { ...bands[1], gain: 0 },
        { ...bands[2], gain: 4 },
        { ...bands[3], gain: 6 },
        { ...bands[4], gain: 8 }
      ], 
      bass: 0, 
      treble: 8 
    },
    'Рок': { 
      bands: [
        { ...bands[0], gain: 4 },
        { ...bands[1], gain: 3 },
        { ...bands[2], gain: 0 },
        { ...bands[3], gain: 3 },
        { ...bands[4], gain: 4 }
      ], 
      bass: 6, 
      treble: 4 
    },
    'Поп': { 
      bands: [
        { ...bands[0], gain: 2 },
        { ...bands[1], gain: 1 },
        { ...bands[2], gain: -1 },
        { ...bands[3], gain: 1 },
        { ...bands[4], gain: 3 }
      ], 
      bass: 3, 
      treble: 5 
    }
  }), [bands]);

  // Инициализация Web Audio API
  const initAudioContext = useCallback(() => {
    try {
      // Проверяем поддержку
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API не поддерживается в этом браузере');
        return null;
      }
      
      const context = new AudioContext();
      setAudioContext(context);
      return context;
    } catch (error) {
      console.error('Ошибка создания AudioContext:', error);
      return null;
    }
  }, []);

  // Создание фильтров
  const createFilters = useCallback((context) => {
    if (!context) return [];
    
    const newFilters = bands.map(band => {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = band.freq;
      filter.Q.value = 1;
      filter.gain.value = band.gain;
      return filter;
    });
    
    setFilters(newFilters);
    return newFilters;
  }, [bands]);

  // Подключение фильтров к аудио
  const connectFiltersToAudio = useCallback(() => {
    const audioElement = document.querySelector('audio');
    if (!audioElement || !audioContext || filters.length === 0) {
      return false;
    }
    
    currentAudioRef.current = audioElement;
    
    try {
      // Создаем источник из аудиоэлемента
      const source = audioContext.createMediaElementSource(audioElement);
      setAudioSource(source);
      
      // Подключаем цепочку фильтров
      let currentNode = source;
      
      filters.forEach(filter => {
        currentNode.connect(filter);
        currentNode = filter;
      });
      
      // Подключаем к выходу
      currentNode.connect(audioContext.destination);
      
      return true;
    } catch (error) {
      console.error('Ошибка подключения фильтров:', error);
      return false;
    }
  }, [audioContext, filters]);

  // Включение/выключение эквалайзера
  const toggleEqualizer = useCallback(() => {
    const newActiveState = !isActive;
    
    if (newActiveState) {
      // Включаем эквалайзер
      const context = audioContext || initAudioContext();
      if (!context) {
        console.warn('Не удалось инициализировать аудиоконтекст');
        setIsActive(false);
        return;
      }
      
      // Создаем фильтры
      const newFilters = createFilters(context);
      if (newFilters.length === 0) {
        console.warn('Не удалось создать фильтры');
        setIsActive(false);
        return;
      }
      
      // Подключаем к аудио
      const connected = connectFiltersToAudio();
      if (!connected) {
        console.warn('Не удалось подключить эквалайзер к аудио');
        setIsActive(false);
        return;
      }
      
      setIsActive(true);
      console.log('Эквалайзер включен (симуляция)');
    } else {
      // Выключаем эквалайзер
      if (audioSource) {
        audioSource.disconnect();
        setAudioSource(null);
      }
      
      setIsActive(false);
      console.log('Эквалайзер выключен');
    }
    
    // Сохраняем состояние
    const savedSettings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
    savedSettings.equalizer = {
      ...savedSettings.equalizer,
      isActive: newActiveState
    };
    localStorage.setItem('audioSettings', JSON.stringify(savedSettings));
  }, [isActive, audioContext, audioSource, initAudioContext, createFilters, connectFiltersToAudio]);

  // Обновление значений фильтров
  const updateFilterValues = useCallback(() => {
    if (!filters || filters.length === 0) return;
    
    bands.forEach((band, index) => {
      if (filters[index]) {
        filters[index].gain.value = band.gain;
      }
    });
  }, [bands, filters]);

  // Обработчики изменений полос
  const handleBandChange = useCallback((index, newGain) => {
    const updatedBands = [...bands];
    updatedBands[index].gain = newGain;
    setBands(updatedBands);
    
    // Обновляем фильтр в реальном времени
    if (isActive && filters[index]) {
      filters[index].gain.value = newGain;
    }
    
    saveSettings(updatedBands, bass, treble);
    updateFilterValues();
  }, [bands, bass, treble, isActive, filters, saveSettings, updateFilterValues]);

  const handleBassChange = useCallback((newBass) => {
    setBass(newBass);
    
    // Здесь можно добавить басовый фильтр
    if (isActive) {
      console.log('Басы обновлены:', newBass);
    }
    
    saveSettings(bands, newBass, treble);
  }, [bands, treble, isActive, saveSettings]);

  const handleTrebleChange = useCallback((newTreble) => {
    setTreble(newTreble);
    
    // Здесь можно добавить высокочастотный фильтр
    if (isActive) {
      console.log('Высокие обновлены:', newTreble);
    }
    
    saveSettings(bands, bass, newTreble);
  }, [bands, bass, isActive, saveSettings]);

  // Сброс настроек
  const handleReset = useCallback(() => {
    const resetBands = bands.map(band => ({ ...band, gain: 0 }));
    setBands(resetBands);
    setBass(0);
    setTreble(0);
    
    // Сбрасываем фильтры
    if (isActive && filters.length > 0) {
      filters.forEach(filter => {
        if (filter) filter.gain.value = 0;
      });
    }
    
    saveSettings(resetBands, 0, 0);
  }, [bands, isActive, filters, saveSettings]);

  // Применение пресета
  const applyPreset = useCallback((presetName) => {
    const presetData = getPresets()[presetName];
    if (presetData) {
      const newBands = presetData.bands;
      const newBass = presetData.bass;
      const newTreble = presetData.treble;
      
      setBands(newBands);
      setBass(newBass);
      setTreble(newTreble);
      
      // Обновляем фильтры
      if (isActive && filters.length > 0) {
        newBands.forEach((band, index) => {
          if (filters[index]) {
            filters[index].gain.value = band.gain;
          }
        });
      }
      
      saveSettings(newBands, newBass, newTreble);
    }
  }, [getPresets, isActive, filters, saveSettings]);

  // Загрузка сохраненных настроек
  useEffect(() => {
    const saved = localStorage.getItem('audioSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.equalizer) {
          const { bands: savedBands, bass: savedBass, treble: savedTreble, isActive: savedActive } = settings.equalizer;
          
          if (savedBands && savedBands.length === bands.length) {
            setBands(savedBands);
          }
          
          if (savedBass !== undefined) setBass(savedBass);
          if (savedTreble !== undefined) setTreble(savedTreble);
          if (savedActive !== undefined) setIsActive(savedActive);
        }
      } catch (e) {
        console.error('Ошибка загрузки настроек:', e);
      }
    }
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (audioSource) {
        audioSource.disconnect();
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [audioSource, audioContext]);

  return (
    <div className="equalizer-container">
      <div className="equalizer-header">
        <h3>
          <Icon name="equalizer" type="emoji" size={24} />
          7-полосный эквалайзер
        </h3>
        <div className="equalizer-controls">
          <button 
            className={`equalizer-toggle ${isActive ? 'active' : ''}`}
            onClick={toggleEqualizer}
            title={isActive ? 'Отключить эквалайзер' : 'Включить эквалайзер'}
          >
            <Icon name={isActive ? "volumeOn" : "volumeOff"} type="png" size={18} />
            <span>{isActive ? 'ВКЛ' : 'ВЫКЛ'}</span>
          </button>
          
          <button 
            className="equalizer-reset"
            onClick={handleReset}
            title="Сбросить настройки"
          >
            <Icon name="refresh" type="svg" size={16} />
            <span>Сброс</span>
          </button>
        </div>
      </div>
      
      <div className="equalizer-status">
        <span className={`status-indicator ${isActive ? 'active' : ''}`}>
          {isActive ? '✅ Активен' : '⏸️ Отключен'}
          {!window.AudioContext && !window.webkitAudioContext && (
            <span style={{ color: '#ff9800', marginLeft: '5px' }}>
              (Web Audio API не поддерживается)
            </span>
          )}
        </span>
      </div>
      
      {/* Основные полосы эквалайзера */}
      <div className="eq-bands-section">
        <h4>Основные частоты</h4>
        <div className="eq-bands">
          {bands.map((band, index) => (
            <div key={band.id} className="eq-band">
              <div className="eq-band-header">
                <label style={{ color: band.color }}>{band.label}</label>
                <span className="eq-band-type">{band.type}</span>
                <span className="eq-band-freq">{band.freq} Гц</span>
              </div>
              
              <div className="eq-slider-container">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={band.gain}
                  onChange={(e) => handleBandChange(index, parseInt(e.target.value))}
                  className="eq-slider"
                  style={{
                    background: `linear-gradient(to top, ${band.color}88, ${band.color})`
                  }}
                  orient="vertical"
                />
              </div>
              
              <div className="eq-value-display">
                <span className={`eq-value ${band.gain > 0 ? 'positive' : band.gain < 0 ? 'negative' : ''}`}>
                  {band.gain > 0 ? '+' : ''}{band.gain} dB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Басы и высокие */}
      <div className="eq-effects-section">
        <h4>Тональные регуляторы</h4>
        <div className="eq-effects">
          <div className="eq-effect bass-effect">
            <div className="eq-effect-header">
              <Icon name="volumeLow" type="png" size={20} />
              <label>Басы (Bass)</label>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={bass}
              onChange={(e) => handleBassChange(parseInt(e.target.value))}
              className="effect-slider"
              style={{
                background: `linear-gradient(to right, #667eea, #764ba2)`
              }}
            />
            <span className={`effect-value ${bass > 0 ? 'positive' : bass < 0 ? 'negative' : ''}`}>
              {bass > 0 ? '+' : ''}{bass} dB
            </span>
          </div>
          
          <div className="eq-effect treble-effect">
            <div className="eq-effect-header">
              <Icon name="volumeOn" type="png" size={20} />
              <label>Высокие (Treble)</label>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={treble}
              onChange={(e) => handleTrebleChange(parseInt(e.target.value))}
              className="effect-slider"
              style={{
                background: `linear-gradient(to right, #ff6b6b, #FF9800)`
              }}
            />
            <span className={`effect-value ${treble > 0 ? 'positive' : treble < 0 ? 'negative' : ''}`}>
              {treble > 0 ? '+' : ''}{treble} dB
            </span>
          </div>
        </div>
      </div>
      
      {/* Пресеты */}
      <div className="eq-presets-section">
        <h4>Готовые пресеты</h4>
        <div className="presets-grid">
          {Object.keys(getPresets()).map(presetName => (
            <button
              key={presetName}
              className="eq-preset"
              onClick={() => applyPreset(presetName)}
              title={`Применить пресет "${presetName}"`}
            >
              {presetName === 'Басы+' && <Icon name="feature1" type="png" size={20} />}
              {presetName === 'Ясность' && <Icon name="musicNote" type="png" size={20} />}
              {presetName === 'Рок' && <Icon name="volumeOn" type="png" size={20} />}
              {presetName === 'Поп' && <Icon name="heart" type="png" size={20} />}
              {presetName === 'Плоский' && <Icon name="refresh" type="svg" size={20} />}
              <span>{presetName}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="eq-info">
        <p>
          <Icon name="info" type="png" size={16} />
          <strong>Настройки сохраняются автоматически</strong> в браузере
        </p>
        <p>
          <Icon name="lightbulb" type="emoji" size={16} />
          <em>Реальная обработка звука:</em> В разработке
        </p>
        {!document.querySelector('audio') && (
          <p style={{ color: '#ff9800' }}>
            <Icon name="warning" type="png" size={16} />
            Включите воспроизведение трека для работы эквалайзера
          </p>
        )}
      </div>
    </div>
  );
};

export default Equalizer;