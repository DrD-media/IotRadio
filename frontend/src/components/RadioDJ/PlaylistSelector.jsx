import React from 'react';
import Icon from '../Icon/Icon';

function PlaylistSelector({ playlists, onSelectPlaylist }) {
  return (
    <div className="playlist-selector">
      <h3>Плейлисты</h3>
      
      <div className="playlists-grid">
        {playlists.length === 0 ? (
          <div className="no-playlists">
            <Icon name="list" type="emoji" size={32} />
            <p>Нет доступных плейлистов</p>
          </div>
        ) : (
          playlists.map(playlist => (
            <div 
              key={playlist.id}
              className="playlist-card"
              onClick={() => onSelectPlaylist(playlist.id)}
            >
              <div className="playlist-card-cover square-cover">
                {playlist.cover ? (
                  <img 
                    src={`/api/cover/${playlist.cover}`} 
                    alt={playlist.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `<div class="cover-placeholder"><span>📋</span></div>`;
                    }}
                  />
                ) : (
                  <div className="cover-placeholder">
                    <Icon name="list" type="emoji" size={32} />
                  </div>
                )}
              </div>
              
              <div className="playlist-card-info">
                <h4>{playlist.name}</h4>
                <p className="track-count">
                  <Icon name="musicNote" type="emoji" size={12} />
                  {playlist.track_ids?.length || 0} треков
                </p>
                {playlist.description && (
                  <p className="playlist-description">{playlist.description}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PlaylistSelector;