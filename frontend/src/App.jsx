import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './components/Icon/Icon';
import './App.css';

// Компоненты для радио (правильные пути)
import TrackSelector from './components/RadioDJ/TrackSelector';
import PlaylistSelector from './components/RadioDJ/PlaylistSelector';
import MicControl from './components/RadioDJ/MicControl';
import ListenersInfo from './components/RadioDJ/ListenersInfo';

// Новые компоненты для навигации
import OnAirPanel from './components/OnAirPanel/OnAirPanel';
import ContentManager from './components/ContentManager/ContentManager';
import EquipmentManager from './components/EquipmentManager/EquipmentManager';

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
  const [activeTab, setActiveTab] = useState('tracks');
  
  // Состояние для навигации
  const [activePanel, setActivePanel] = useState('onair'); // 'onair', 'content', 'equipment'
  
  // Состояние микшера
  const [mixerEnabled, setMixerEnabled] = useState(false);
  
  const currentYear = new Date().getFullYear();

  // Загружаем начальные данные
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        const [tracksRes, playlistsRes, statusRes] = await Promise.all([
          axios.get('/api/tracks'),
          axios.get('/api/playlists'),
          axios.get('/api/radio/status')
        ]);
        
        setTracks(tracksRes.data);
        setPlaylists(playlistsRes.data);
        setRadioStatus({
          ...statusRes.data,
          mixer_enabled: statusRes.data.mixer_enabled || false
        });
        setMixerEnabled(statusRes.data.mixer_enabled || false);
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Не удалось загрузить данные');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    const interval = setInterval(async () => {
      try {
        const statusRes = await axios.get('/api/radio/status');
        setRadioStatus(prev => ({
          ...prev,
          ...statusRes.data,
          mixer_enabled: statusRes.data.mixer_enabled || false
        }));
        setMixerEnabled(statusRes.data.mixer_enabled || false);
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

  const toggleMixer = async () => {
    try {
      const newState = !mixerEnabled;
      await axios.post('/api/radio/mixer', { enable: newState });
      setMixerEnabled(newState);
      console.log(`🎛️ Режим микшера: ${newState ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    } catch (err) {
      console.error('Error toggling mixer:', err);
      alert('Ошибка при переключении режима микшера');
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

  // Рендер активной панели
  const renderActivePanel = () => {
    switch (activePanel) {
      case 'onair':
        return (
          <OnAirPanel
            radioStatus={radioStatus}
            tracks={tracks}
            playlists={playlists}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            playTrack={playTrack}
            playPlaylist={playPlaylist}
            toggleMic={toggleMic}
            stopRadio={stopRadio}
            mixerEnabled={mixerEnabled}
            toggleMixer={toggleMixer}
          />
        );
      case 'content':
        return <ContentManager />;
      case 'equipment':
        return <EquipmentManager />;
      default:
        return null;
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
                <div className="nav-buttons">
                <h2>
                  <Icon name="sparks" type="png" size={26} />
                  Панель управления радио
                </h2>
                  <button 
                    className={`nav-btn ${activePanel === 'onair' ? 'active' : ''}`}
                    onClick={() => setActivePanel('onair')}
                  >
                    <Icon name="radio" type="emoji" size={18} />
                    Панель эфира
                  </button>
                  <button 
                    className={`nav-btn ${activePanel === 'content' ? 'active' : ''}`}
                    onClick={() => setActivePanel('content')}
                  >
                    <Icon name="folder" type="emoji" size={18} />
                    Менеджер контента
                  </button>
                  <button 
                    className={`nav-btn ${activePanel === 'equipment' ? 'active' : ''}`}
                    onClick={() => setActivePanel('equipment')}
                  >
                    <Icon name="speaker" type="emoji" size={18} />
                    Управление оборудованием
                  </button>
                </div>
              </div>

              <div className="header-right">
                <ListenersInfo count={radioStatus.listeners} />
              </div>
            </header>

            {/* Основной контент */}
            {renderActivePanel()}

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
      </Routes>
    </Router>
  );
}

export default App;