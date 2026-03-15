import React from 'react';
import Icon from '../Icon/Icon';

function TrackSelector({ tracks, currentTrack, onSelectTrack }) {
  return (
    <div className="track-selector">
      <h3>Библиотека треков</h3>
      
      <div className="tracks-grid">
        {tracks.length === 0 ? (
          <div className="no-tracks">
            <Icon name="musicNote" type="emoji" size={32} />
            <p>Нет доступных треков</p>
          </div>
        ) : (
          tracks.map(track => (
            <div 
              key={track.id}
              className={`track-card ${currentTrack?.id === track.id ? 'active' : ''}`}
              onClick={() => onSelectTrack(track.id)}
            >
              <div className="track-card-cover square-cover">
                {track.cover ? (
                  <img 
                    src={`/api/cover/${track.cover}`} 
                    alt={track.title}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `<div class="cover-placeholder"><span>🎵</span></div>`;
                    }}
                  />
                ) : (
                  <div className="cover-placeholder">
                    <Icon name="musicNote" type="emoji" size={24} />
                  </div>
                )}
              </div>
              
              <div className="track-card-info">
                <h4>{track.title}</h4>
                <p className="track-artist">
                  <Icon name="mic" type="emoji" size={10} />
                  {track.artist || 'Неизвестный исполнитель'}
                </p>
                {track.description && (
                  <p className="track-description">{track.description}</p>
                )}
              </div>
              
              {currentTrack?.id === track.id && (
                <div className="playing-badge">
                  <Icon name="play" type="svg" size={10} />
                  <span>В эфире</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TrackSelector;