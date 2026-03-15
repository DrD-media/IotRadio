import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Icon from '../Icon/Icon';
import './DebugRadio.css';

function DebugRadio() {
  const [radioStatus, setRadioStatus] = useState({
    is_live: false,
    current_track: null,
    mic_active: false,
    listeners: 0,
    queue_size: 0
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  const audioRef = useRef(null);
  const streamUrl = `http://${window.location.hostname}:5000/api/radio/stream`;
  const reconnectTimeoutRef = useRef(null);
  const prevTrackIdRef = useRef(null);
  const prevMicStateRef = useRef(false);

  // ПОЛУЧАЕМ СТАТУС КАЖДЫЕ 2 СЕКУНДЫ
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`http://${window.location.hostname}:5000/api/radio/status`);
        setRadioStatus(response.data);
      } catch (err) {
        console.error('Status error:', err);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // ФУНКЦИИ
  const createNewAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }

    const audio = new Audio();
    audio.src = streamUrl;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    
    audio.onplay = () => {
      console.log('▶️ Аудио играет');
      setIsPlaying(true);
      setAudioError(null);
    };
    
    audio.onpause = () => {
      console.log('⏸️ Аудио на паузе');
      setIsPlaying(false);
    };
    
    audio.onerror = (e) => {
      console.error('❌ Ошибка аудио:', e);
      const error = audio.error;
      if (error) {
        console.log('Код ошибки:', error.code);
        console.log('Сообщение:', error.message);
      }
      
      // Игнорируем ошибки при переподключении
      if (error?.code === 4) {
        console.log('Ожидаемая ошибка при переподключении');
        return;
      }
      
      setAudioError(`Ошибка воспроизведения (код: ${error?.code || 'unknown'})`);
      setIsPlaying(false);
    };
    
    audio.onended = () => {
      console.log('⏹️ Аудио закончилось');
      setIsPlaying(false);
    };
    
    audio.oncanplay = () => {
      console.log('✅ Можно играть');
    };
    
    audioRef.current = audio;
  };

  const reconnectAudio = () => {
    console.log('🔄 Принудительное переподключение');
    const wasPlaying = isPlaying;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }
    
    createNewAudio();
    
    if (wasPlaying) {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            console.error('Ошибка воспроизведения после переподключения:', err);
          });
        }
      }, 100);
    }
    
    setReconnectAttempt(prev => prev + 1);
  };

  // ИНИЦИАЛИЗАЦИЯ АУДИО
  useEffect(() => {
    createNewAudio();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
    };
  }, []);

  // ОТСЛЕЖИВАЕМ РЕАЛЬНЫЕ ИЗМЕНЕНИЯ
  useEffect(() => {
    const currentTrackId = radioStatus.current_track?.id;
    const currentMicState = radioStatus.mic_active;
    
    // Проверяем, действительно ли что-то изменилось
    const trackChanged = prevTrackIdRef.current !== currentTrackId;
    const micChanged = prevMicStateRef.current !== currentMicState;
    
    if ((trackChanged || micChanged) && isPlaying) {
      console.log('🔄 Источник изменился, переподключаемся', {
        trackChanged,
        micChanged
      });
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAudio();
      }, 500);
    }
    
    // Обновляем рефы
    prevTrackIdRef.current = currentTrackId;
    prevMicStateRef.current = currentMicState;
    
  }, [radioStatus.current_track?.id, radioStatus.mic_active, isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Проверяем, есть ли что играть
      if (!radioStatus.current_track && !radioStatus.mic_active) {
        setAudioError('Эфир не активен');
        return;
      }
      
      audioRef.current.play().catch(err => {
        console.error('Play error:', err);
        if (err.name === 'AbortError' || err.name === 'NotSupportedError') {
          // Игнорируем ошибки при переподключении
          return;
        }
        setAudioError(`Ошибка воспроизведения: ${err.message}`);
      });
    }
  };

  const formatTrackInfo = () => {
    if (radioStatus.current_track) {
      return `${radioStatus.current_track.title} - ${radioStatus.current_track.artist}`;
    } else if (radioStatus.mic_active) {
      return '🎤 Микрофон в эфире';
    } else {
      return '⏸️ Эфир не активен';
    }
  };

  return (
    <div className="debug-radio-container">
      <div className="debug-radio-card">
        <div className="debug-header">
          <h1>
            <Icon name="radio" type="emoji" size={28} />
            Техническая страница радио
          </h1>
          <span className="debug-badge">🔧 DEBUG</span>
        </div>

        <div className="stream-info">
          <div className="info-row">
            <span className="info-label">Адрес потока:</span>
            <code className="stream-url">{streamUrl}</code>
          </div>
        </div>

        <div className="player-section">
          <div className="status-indicator">
            <span className={`status-led ${radioStatus.is_live || radioStatus.mic_active ? 'live' : 'offline'}`}>
              {radioStatus.is_live || radioStatus.mic_active ? '🔴 LIVE' : '⭕ OFFLINE'}
            </span>
            <span className="now-playing">
              {formatTrackInfo()}
            </span>
            {reconnectAttempt > 0 && (
              <span className="reconnect-badge">
                Переподключений: {reconnectAttempt}
              </span>
            )}
          </div>

          <div className="audio-controls">
            <button 
              className={`play-button ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
              disabled={!radioStatus.current_track && !radioStatus.mic_active}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} type="svg" size={24} />
              <span>{isPlaying ? 'Остановить' : 'Слушать эфир'}</span>
            </button>

            <button 
              className="refresh-button"
              onClick={reconnectAudio}
              title="Переподключиться к потоку"
            >
              <Icon name="refresh" type="svg" size={20} />
            </button>
          </div>

          {audioError && (
            <div className="error-message">
              <Icon name="warning" type="emoji" size={16} />
              {audioError}
              <button 
                className="retry-button"
                onClick={reconnectAudio}
              >
                Повторить
              </button>
            </div>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Слушателей</div>
            <div className="stat-value">{radioStatus.listeners}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Буфер</div>
            <div className="stat-value">{radioStatus.queue_size}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Микрофон</div>
            <div className={`stat-value ${radioStatus.mic_active ? 'active' : 'inactive'}`}>
              {radioStatus.mic_active ? 'ВКЛ' : 'ВЫКЛ'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Трек ID</div>
            <div className="stat-value">
              {radioStatus.current_track?.id || '—'}
            </div>
          </div>
        </div>

        {radioStatus.current_track && (
          <div className="track-info">
            <div className="track-cover">
              {radioStatus.current_track.cover ? (
                <img 
                  src={`http://localhost:5000/api/cover/${radioStatus.current_track.cover}`}
                  alt={radioStatus.current_track.title}
                />
              ) : (
                <div className="cover-placeholder">
                  <Icon name="musicNote" type="emoji" size={32} />
                </div>
              )}
            </div>
            <div className="track-details">
              <div className="track-title">{radioStatus.current_track.title}</div>
              <div className="track-artist">{radioStatus.current_track.artist}</div>
            </div>
          </div>
        )}

        <div className="debug-footer">
          <p>Техническая страница для отладки радио-потока</p>
          <p className="small">Доступна только по прямой ссылке</p>
        </div>
      </div>
    </div>
  );
}

export default DebugRadio;