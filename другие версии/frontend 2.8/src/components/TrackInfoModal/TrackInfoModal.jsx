import React, { useState } from 'react';
import Icon from '../Icon/Icon';
import './TrackInfoModal.css';

const TrackInfoModal = ({ track, isOpen, onClose, API_URL = '' }) => {
  const [selectedTexts, setSelectedTexts] = useState([]);
  const [textContents, setTextContents] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !track) return null;

  // Используем track_texts (с "s") из вашего JSON
  const trackTexts = track.track_texts || [];

  const handleTextToggle = async (textId) => {
    // Если текст уже выбран - убираем его
    if (selectedTexts.includes(textId)) {
      setSelectedTexts(selectedTexts.filter(id => id !== textId));
      return;
    }
    
    // Если текст не выбран и ещё не загружен - загружаем
    if (!textContents[textId]) {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/track-text/${track.id}/${textId}`);
        if (response.ok) {
          const data = await response.json();
          setTextContents(prev => ({
            ...prev,
            [textId]: data.content || 'Текст не доступен'
          }));
        } else {
          setTextContents(prev => ({
            ...prev,
            [textId]: 'Ошибка загрузки'
          }));
        }
      } catch (error) {
        console.error(`Error loading text ${textId}:`, error);
        setTextContents(prev => ({
          ...prev,
          [textId]: 'Ошибка соединения'
        }));
      } finally {
        setIsLoading(false);
      }
    }
    
    // Добавляем текст в выбранные
    setSelectedTexts([...selectedTexts, textId]);
  };

  const getTextColumns = () => {
    if (selectedTexts.length === 0) return null;
    if (selectedTexts.length === 1) return '1fr';
    console.log('Track data:', track);
console.log('Description:', track.description);
console.log('Track texts:', track.track_texts);
    return '1fr 1fr';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="track-info-modal" onClick={e => e.stopPropagation()}>
        {/* Кнопка закрытия */}
        <button className="modal-close-btn" onClick={onClose}>
          <Icon name="close" type="png" size={24} />
        </button>

        {/* Верхний блок - информация о треке */}
        <div className="track-info-header">
          <div className="track-info-cover">
            {track.cover ? (
              <img 
                src={`${API_URL}/api/cover/${track.cover}`}
                alt={track.title}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23667eea"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">🎵</text></svg>';
                }}
              />
            ) : (
              <div className="track-info-cover-placeholder">
                🎵
              </div>
            )}
          </div>
          
          <div className="track-info-details">
            <h2 className="track-info-title">{track.title}</h2>
            <div className="track-info-artist">{track.artist}</div>
            <div className="track-info-description">
              {/* Исправлено: используем track.description */}
              {track.description || 'Нет описания'}
            </div>
            <div className="track-info-meta">
              <span className="track-info-id">ID: {track.id}</span>
              <span className="track-info-date">
                {track.created_date ? `Добавлен: ${track.created_date}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Нижний блок - тексты трека (если есть) */}
        {trackTexts.length > 0 && (
          <div className="track-texts-section">
            <div className="track-texts-header">
              <h3>Тексты песни</h3>
              <div className="text-selection-buttons">
                {trackTexts.map(text => (
                  <button
                    key={text.id}
                    className={`text-select-btn ${selectedTexts.includes(text.id) ? 'active' : ''}`}
                    onClick={() => handleTextToggle(text.id)}
                    disabled={isLoading}
                  >
                    {text.title}
                    {isLoading && selectedTexts.includes(text.id) && ' (загрузка...)'}
                  </button>
                ))}
              </div>
            </div>

            {selectedTexts.length > 0 && (
              <div 
                className="track-texts-content"
                style={{ gridTemplateColumns: getTextColumns() }}
              >
                {selectedTexts.map(textId => {
                  const text = trackTexts.find(t => t.id === textId);
                  return (
                    <div key={textId} className="text-column">
                      <div className="text-column-header">
                        <h4>{text.title}</h4>
                        <span className="text-language">{text.language}</span>
                      </div>
                      <div className="text-column-content">
                        {textContents[textId] ? (
                          <pre>{textContents[textId]}</pre>
                        ) : (
                          <div className="text-loading">
                            {isLoading ? 'Загрузка...' : 'Нажмите чтобы загрузить'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTexts.length === 0 && (
              <div className="no-texts-selected">
                Выберите текст для отображения (нажмите на кнопку выше)
              </div>
            )}
          </div>
        )}

        {trackTexts.length === 0 && (
          <div className="no-texts-available">
            Тексты для этого трека не добавлены или трек без слов
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackInfoModal;