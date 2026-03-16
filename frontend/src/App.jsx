import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './components/Icon/Icon';
import './App.css';

// Компоненты для радио
import TrackSelector from './components/RadioDJ/TrackSelector';
import PlaylistSelector from './components/RadioDJ/PlaylistSelector';
import MicControl from './components/RadioDJ/MicControl';
import ListenersInfo from './components/RadioDJ/ListenersInfo';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DebugRadio from './components/DebugRadio/DebugRadio';

function App() {
  // Состояния радио
  const [radioStatus, setRadioStatus] = useState({
    is_live: false,
    current_track: null,
    current_playlist: null,
    mic_active: false,
    listeners: 0,
    queue_size: 0
  });
  
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tracks'); // 'tracks' или 'playlists'
  
  // Текущий год для футера
  const currentYear = new Date().getFullYear();

  // Загружаем начальные данные
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Параллельно загружаем треки, плейлисты и статус радио
        const [tracksRes, playlistsRes, statusRes] = await Promise.all([
          axios.get('/api/tracks'),
          axios.get('/api/playlists'),
          axios.get('/api/radio/status')
        ]);
        
        setTracks(tracksRes.data);
        setPlaylists(playlistsRes.data);
        setRadioStatus(statusRes.data);
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Не удалось загрузить данные');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Обновляем статус каждые 2 секунды
    const interval = setInterval(async () => {
      try {
        const statusRes = await axios.get('/api/radio/status');
        setRadioStatus(statusRes.data);
      } catch (err) {
        console.error('Error updating status:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Функции управления радио
  const playTrack = async (trackId) => {
    try {
      await axios.post(`/api/radio/play/${trackId}`);
    } catch (err) {
      console.error('Error playing track:', err);
      alert('Ошибка при запуске трека');
    }
  };

  const playPlaylist = async (playlistId) => {
    try {
      await axios.post(`/api/radio/playlist/${playlistId}`);
    } catch (err) {
      console.error('Error playing playlist:', err);
      alert('Ошибка при запуске плейлиста');
    }
  };

  const toggleMic = async () => {
    try {
      const action = radioStatus.mic_active ? 'off' : 'on';
      await axios.post('/api/radio/mic', { action });
    } catch (err) {
      console.error('Error toggling mic:', err);
      alert('Ошибка при управлении микрофоном');
    }
  };

  const stopRadio = async () => {
    try {
      await axios.post('/api/radio/stop');
    } catch (err) {
      console.error('Error stopping radio:', err);
      alert('Ошибка при остановке');
    }
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <Icon name="hourglass_not_done" type="png" size={40} />
        <p>Загрузка радио...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <Icon name="close" type="png" size={40} />
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          <Icon name="refresh" type="svg" size={18} />
          Обновить
        </button>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="radio-app">
            {/* Шапка */}
            <header className="radio-header">
              <div className="header-left">
                <div className="logo">DrD Radio</div>
              </div>

              <div className="header-center">
                <h1>
                  <Icon name="sparks" type="png" size={24} />
                  Панель управления радио
                </h1>
              </div>

              <div className="header-right">
                <ListenersInfo count={radioStatus.listeners} />
              </div>
            </header>

            {/* Основной контент */}
            <main className="radio-main">
              {/* Левая колонка - текущий эфир */}
              <div className="now-playing-column">
                <div className="now-playing-card">
                  <h2>Сейчас в эфире</h2>

                  {radioStatus.current_track ? (
                    <div className="current-track">
                      <div className="track-cover">
                        <div className="square-cover">
                          {radioStatus.current_track?.cover ? (
                            <img 
                              src={`/api/cover/${radioStatus.current_track.cover}`}
                              alt={radioStatus.current_track?.title}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `<div class="cover-placeholder"><span>🎵</span></div>`;
                              }}
                            />
                          ) : (
                            <div className="cover-placeholder">
                              <Icon name="musicNote" type="emoji" size={48} />
                            </div>
                          )}
                        </div>
                      </div>
                        
                      <div className="track-info">
                        <h3>{radioStatus.current_track?.title || 'Нет трека'}</h3>
                        <p className="artist">{radioStatus.current_track?.artist || 'Неизвестный исполнитель'}</p>
                        {radioStatus.current_playlist && (
                          <p className="playlist-badge">
                            Из плейлиста: {radioStatus.current_playlist.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-track">
                      <Icon name="musicNote" type="png" size={32} />
                      <p>Эфир не активен</p>
                    </div>
                  )}

                  <div className="mic-status">
                    <div className={`mic-indicator ${radioStatus.mic_active ? 'active' : ''}`}>
                      <Icon name="mic" type="png" size={20} />
                      <span>Микрофон {radioStatus.mic_active ? 'включен' : 'выключен'}</span>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <MicControl 
                      isActive={radioStatus.mic_active} 
                      onToggle={toggleMic} 
                    />

                    <button 
                      className="stop-btn"
                      onClick={stopRadio}
                      disabled={!radioStatus.is_live}
                    >
                      <Icon name="stop" type="png" size={20} />
                      Остановить эфир
                    </button>
                  </div>
                </div>
              </div>
                
              {/* Правая колонка - управление */}
              <div className="control-column">
                <div className="tabs">
                  <button 
                    className={`tab-btn ${activeTab === 'tracks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tracks')}
                  >
                    Треки
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === 'playlists' ? 'active' : ''}`}
                    onClick={() => setActiveTab('playlists')}
                  >
                    Плейлисты
                  </button>
                </div>
                
                <div className="tab-content">
                  {activeTab === 'tracks' ? (
                    <TrackSelector 
                      tracks={tracks}
                      currentTrack={radioStatus.current_track}
                      onSelectTrack={playTrack}
                    />
                  ) : (
                    <PlaylistSelector 
                      playlists={playlists}
                      onSelectPlaylist={playPlaylist}
                    />
                  )}
                </div>
              </div>
            </main>
                
            {/* Футер */}
            <footer className="radio-footer">
              <div className="footer-left">
                <div className="queue-info">
                  Буфер: {radioStatus.queue_size} чанков
                </div>
              </div>
                
              <div className="footer-center">
                <p>DrD Radio © {currentYear} | Поток: http://{window.location.hostname}:5000/api/radio/stream</p>
              </div>
                
              <div className="footer-right">
                <div className="stream-status">
                  {radioStatus.is_live ? (
                    <span className="live">🔴 LIVE</span>
                  ) : (
                    <span className="offline">⭕ OFFLINE</span>
                  )}
                </div>
              </div>
            </footer>
          </div>
        } />
        <Route path="/debug/radio" element={<DebugRadio />} />
        {/* <Route path="/test-radio" element={<TestRadio />} /> */}
      </Routes>
    </Router>

    
  );
}

export default App;