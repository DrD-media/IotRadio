import React, { useState, useEffect } from 'react';
import Icon from '../../Icon/Icon';
import './VolumeBoost.css';

const VolumeBoost = ({ volume, isBoosted, onVolumeChange, onBoostToggle }) => {
  const [localVolume, setLocalVolume] = useState(volume);
  const [localBoosted, setLocalBoosted] = useState(isBoosted);

  // Загружаем сохраненные настройки при открытии
  useEffect(() => {
    const savedSettings = localStorage.getItem('audioSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.volume !== undefined) {
          setLocalVolume(settings.volume);
        }
        if (settings.boosted !== undefined) {
          setLocalBoosted(settings.boosted);
        }
      } catch (e) {
        console.error('Error loading volume settings:', e);
      }
    }
  }, []);

  // Применяем громкость к аудио элементу
  const applyVolumeToAudio = (newVolume, boosted) => {
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      // Рассчитываем реальную громкость
      let realVolume = newVolume;
      
      // Если буст включен, увеличиваем громкость
      if (boosted) {
        // Плавное увеличение: при 100% ползунке = 200% громкости
        // Формула: realVolume = volume + (volume * boostFactor)
        const boostFactor = 1.0; // 100% увеличение
        realVolume = Math.min(newVolume + (newVolume * boostFactor), 2.0);
      }
      
      // Ограничиваем максимальную громкость
      realVolume = Math.min(realVolume, 2.0);
      audioElement.volume = realVolume;
      
      // Сохраняем текущую реальную громкость для быстрого доступа
      audioElement.dataset.boosted = boosted ? 'true' : 'false';
      audioElement.dataset.baseVolume = newVolume.toString();
    }
  };

  const handleBoostToggle = () => {
    const newBoosted = !localBoosted;
    setLocalBoosted(newBoosted);
    
    // Применяем новые настройки
    applyVolumeToAudio(localVolume, newBoosted);
    
    // Сохраняем в localStorage
    const savedSettings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
    savedSettings.boosted = newBoosted;
    localStorage.setItem('audioSettings', JSON.stringify(savedSettings));
    
    // Уведомляем родительский компонент
    if (onBoostToggle) {
      onBoostToggle(newBoosted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    
    // Применяем изменения в реальном времени
    applyVolumeToAudio(newVolume, localBoosted);
    
    // Уведомляем родительский компонент
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
  };

  const handleVolumeMouseUp = () => {
    // Сохраняем настройки
    const savedSettings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
    savedSettings.volume = localVolume;
    localStorage.setItem('audioSettings', JSON.stringify(savedSettings));
  };

  // Рассчитываем отображаемый процент
  const getDisplayPercent = () => {
    const basePercent = Math.round(localVolume * 100);
    if (localBoosted) {
      // Показываем увеличенный процент (но не более 200%)
      const boostedPercent = Math.min(basePercent * 2, 200);
      return boostedPercent;
    }
    return basePercent;
  };

  // Рассчитываем реальную громкость в процентах
  const getRealVolumePercent = () => {
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      return Math.round(audioElement.volume * 100);
    }
    return getDisplayPercent();
  };

  // Определяем иконку громкости
  const getVolumeIcon = () => {
    const realVolume = getRealVolumePercent();
    if (realVolume === 0) return "volumeOff";
    if (realVolume > 100) return "volumeOnMax";
    if (realVolume > 50) return "volumeOn";
    return "volumeLow";
  };

  return (
    <div className="volume-boost-settings">
      <div className="boost-header">
        <h3>Усиление громкости</h3>
        <div className={`boost-status ${localBoosted ? 'active' : ''}`}>
          <Icon name={getVolumeIcon()} type="png" size={18} />
          <span>{localBoosted ? 'ВКЛ (×2)' : 'ВЫКЛ (×1)'}</span>
        </div>
      </div>
      
      <div className="boost-description">
        <p>
          {localBoosted 
            ? '✅ Усиление активно: максимальная громкость увеличена в 2 раза'
            : '⚡ Включите для увеличения максимальной громкости'}
        </p>
        <p className="boost-warning">
          ⚠️ Внимание: высокий уровень громкости может повредить слух! Используйте наушники осторожно.
        </p>
      </div>

      <div className="boost-control">
        <button 
          className={`boost-toggle-btn ${localBoosted ? 'active' : ''}`}
          onClick={handleBoostToggle}
          title={localBoosted ? 'Отключить усиление' : 'Включить усиление'}
        >
          <Icon 
            name={localBoosted ? "feature1" : "feature2"} 
            type="png" 
            size={20} 
          />
          <span>{localBoosted ? 'Отключить усиление' : 'Включить усиление'}</span>
          <span className="boost-multiplier">{localBoosted ? '×2' : '×1'}</span>
        </button>
        
        <div className="volume-slider-container">
          <div className="volume-header">
            <label>Громкость</label>
            <div className="volume-percent-display">
              <span className="volume-percent">{getDisplayPercent()}%</span>
              {localBoosted && (
                <span className="real-volume-percent">
                  (реальная: {getRealVolumePercent()}%)
                </span>
              )}
            </div>
          </div>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={localVolume}
            onChange={handleVolumeChange}
            onMouseUp={handleVolumeMouseUp}
            onTouchEnd={handleVolumeMouseUp}
            className="volume-slider"
            style={{
              background: `linear-gradient(to right, #667eea 0%, #764ba2 ${localVolume * 100}%, rgba(255, 255, 255, 0.2) ${localVolume * 100}%)`
            }}
          />
          
          <div className="volume-labels">
            <span>0%</span>
            <span>50%</span>
            <span>{localBoosted ? '200%' : '100%'}</span>
          </div>
        </div>
      </div>

      <div className="volume-info">
        <div className="info-item">
          <Icon name="info" type="png" size={16} />
          <span>
            <strong>Текущий режим:</strong> {localBoosted ? 'Усиление включено' : 'Обычная громкость'}
          </span>
        </div>
        <div className="info-item">
          <Icon name="volumeOn" type="png" size={16} />
          <span>
            <strong>Максимальная громкость:</strong> {localBoosted ? '200%' : '100%'}
          </span>
        </div>
        {localBoosted && (
          <div className="boost-tip">
            <Icon name="lightbulb" type="emoji" size={16} />
            <span>
              <strong>Совет:</strong> При усилении устанавливайте громкость ниже 70% для чистого звука
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VolumeBoost;