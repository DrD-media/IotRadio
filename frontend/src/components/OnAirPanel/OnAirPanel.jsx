import React from 'react';
import TrackSelector from '../RadioDJ/TrackSelector';
import PlaylistSelector from '../RadioDJ/PlaylistSelector';
import MicControl from '../RadioDJ/MicControl';
import ListenersInfo from '../RadioDJ/ListenersInfo';
import Icon from '../Icon/Icon';

function OnAirPanel({ 
  radioStatus, 
  tracks, 
  playlists, 
  activeTab, 
  setActiveTab, 
  playTrack, 
  playPlaylist, 
  toggleMic, 
  stopRadio,
  mixerEnabled,
  toggleMixer
}) {
  return (
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
              className={`mixer-btn ${mixerEnabled ? 'active' : ''}`}
              onClick={toggleMixer}
              title={mixerEnabled ? 'Выключить микширование' : 'Включить микширование'}
            >
              <Icon name="mixer" type="emoji" size={20} />
              {mixerEnabled ? '🎛️ Микширование ВКЛ' : '🎛️ Раздельный режим'}
            </button>

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
  );
}

export default OnAirPanel;