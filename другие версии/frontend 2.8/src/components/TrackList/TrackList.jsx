import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../Icon/Icon.jsx';
import SearchAndSort from '../SearchAndSort/SearchAndSort.jsx';
import './TrackList.css';

function TrackList({ 
  tracks: allTracks,  // Переименовываем в allTracks для ясности
  currentTrack, 
  isPlaying, 
  isLoading, 
  error, 
  loopPlaylist,
  onTrackSelect, 
  onLikeTrack, 
  onDownloadTrack, 
  onReloadTracks,
  onToggleLoopPlaylist,
  onSetFilteredTracks,
  // API_URL
}) {

  const [searchParams, setSearchParams] = useState({ query: "", type: "all" });
  const [sortParams, setSortParams] = useState({ field: "id", direction: "asc" });
  
  // Функция фильтрации треков
  const filterTracks = useCallback((tracks, search) => {
    if (!search.query.trim()) return tracks;
    
    const query = search.query.toLowerCase().trim();
    
    return tracks.filter(track => {
      switch (search.type) {
        case "title":
          return track.title.toLowerCase().includes(query);
        case "artist":
          return track.artist.toLowerCase().includes(query);
        case "date":
          return track.created_date?.toLowerCase().includes(query);
        case "id":
          return track.id.toString().includes(query);
        case "all":
        default:
          return (
            track.title.toLowerCase().includes(query) ||
            track.artist.toLowerCase().includes(query) ||
            track.created_date?.toLowerCase().includes(query) ||
            track.id.toString().includes(query)
          );
      }
    });
  }, []);
  
  // Функция сортировки треков
  const sortTracks = useCallback((tracks, sort) => {
    return [...tracks].sort((a, b) => {
      let aValue, bValue;
      
      // Выбираем поле для сортировки
      switch (sort.field) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "artist":
          aValue = a.artist.toLowerCase();
          bValue = b.artist.toLowerCase();
          break;
        case "created_date":
          aValue = a.created_date || "";
          bValue = b.created_date || "";
          break;
        case "id":
        default:
          aValue = a.id;
          bValue = b.id;
          break;
      }
      
      // Сравниваем значения
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;
      
      // Применяем направление сортировки
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, []);
  
  // Применяем фильтрацию и сортировку
  const filteredAndSortedTracks = useMemo(() => {
    let result = allTracks;
    
    // Фильтрация
    if (searchParams.query) {
      result = filterTracks(result, searchParams);
    }
    
    // Сортировка
    result = sortTracks(result, sortParams);
    
    return result;
  }, [allTracks, searchParams, sortParams, filterTracks, sortTracks]);

  useEffect(() => {
    if (onSetFilteredTracks) {
      onSetFilteredTracks(filteredAndSortedTracks);
    }
  }, [filteredAndSortedTracks, onSetFilteredTracks]);
  
  // Обработчики для SearchAndSort
  const handleSearchChange = useCallback((search) => {
    setSearchParams(search);
  }, []);
  
  const handleSortChange = useCallback((sort) => {
    setSortParams(sort);
  }, []);

  if (isLoading) {
    return (
      <div className="track-list">
        <div className="loading-tracks">
          <p>⏳ Загрузка списка треков...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="track-list">
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={onReloadTracks} className="refresh-btn small">
            <Icon name="refresh" type="svg" size={22} />
          </button>
        </div>
      </div>
    );
  }

  if (allTracks.length === 0) {  // Исправлено здесь
    return (
      <div className="track-list">
        <div className="empty-list">
          <p>📭 Нет доступных треков</p>
          <p className="hint">Добавьте аудиофайлы в папку backend/music_files/</p>
          <p className="hint">Поддерживаемые форматы: MP3, WAV, OGG, FLAC, M4A, AAC</p>
          <button onClick={onReloadTracks} className="refresh-btn small">
            <Icon name="refresh" type="svg" size={22} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="track-list">
      {/* Добавляем блок поиска и сортировки */}
      <SearchAndSort
        tracks={filteredAndSortedTracks}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        initialSearchType="all"
        initialSortField="id"
        initialSortDirection="asc"
      />

      <div className="track-list-header">
        <h3>Библиотека треков ({filteredAndSortedTracks.length}
          {searchParams.query && ` из ${allTracks.length}`})  {/* Исправлено здесь */}
        </h3>
        <div className="track-list-actions">
          <button 
            onClick={onToggleLoopPlaylist} 
            className={`loop-playlist-btn ${loopPlaylist ? 'active' : ''}`}
            title={loopPlaylist ? 'Проигрывать только выбранный трек' : 'Зациклить весь список треков'}
          >
            <Icon 
              name={loopPlaylist ? "loopListOn" : "loopList"} 
              type="svg" 
              size={22} 
            />
            <span className="btn-text">
              {loopPlaylist ? 'Весь список' : 'Только выбранный'}
            </span>
          </button>
          <button onClick={onReloadTracks} className="refresh-btn small" title="Обновить список треков">
            <Icon name="refresh" type="svg" size={22} />
          </button>
        </div>
      </div>

      <div className={`tracks-container ${filteredAndSortedTracks.length > 5 ? 'scrollable' : ''}`}>
        {filteredAndSortedTracks.length === 0 ? (
          <div className="no-results">
            <p>🔍 Ничего не найдено по запросу "{searchParams.query}"</p>
            <button 
              onClick={() => setSearchParams({ query: "", type: "all" })}
              className="clear-search-btn"
            >
              Очистить поиск
            </button>
          </div>
        ) : (
          <ul className="tracks">
          {filteredAndSortedTracks.map((track, index) => (
            <li 
              key={track.id} 
              className={`track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
              onClick={() => onTrackSelect(track)}
            >
              <span className="track-number">{index + 1}</span>
              <div className="track-cover">
                {track.cover ? (
                  <img 
                    src={`/api/cover/${track.cover}`}
                    alt={track.title}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.parentElement.innerHTML = `
                        <div class="track-cover-placeholder">
                          🎵
                        </div>
                      `;
                    }}
                  />
                ) : (
                  <div className="track-cover-placeholder">
                    🎵
                  </div>
                )}
              </div>
              <div className="track-details">
                <strong className="track-title">{track.title}</strong>
                <span className="track-artist">{track.artist}</span>
              </div>
              <div className="track-actions">
                <div className="track-status">
                  {currentTrack?.id === track.id && isPlaying && (
                    <span className="playing-indicator">
                      <Icon name="play" type="svg" size={16} /> Играет
                    </span>
                  )}
                  {currentTrack?.id === track.id && !isPlaying && (
                    <span className="paused-indicator">
                      <Icon name="pause" type="svg" size={16} /> На паузе
                    </span>
                  )}
                </div>
                <button 
                  className={`track-like-btn ${track.liked ? 'liked' : ''}`}
                  onClick={(e) => onLikeTrack(track.id, e)}
                  title={track.liked ? 'Убрать из избранного' : 'Добавить в избранное'}
                >
                  <Icon 
                    name={track.liked ? "heartFilled" : "heart"} 
                    type="png" 
                    size={20}
                    color={track.liked ? "#ff6b6b" : undefined}
                  />
                </button>
                <button 
                  className="track-download-btn"
                  onClick={(e) => onDownloadTrack(track, e)}
                  title="Скачать трек"
                >
                  <Icon name="download" type="svg" size={20} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  );
}

export default TrackList;