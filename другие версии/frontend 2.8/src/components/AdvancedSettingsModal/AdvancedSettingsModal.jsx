import React, { useState } from 'react';
import Icon from '../Icon/Icon';
import './AdvancedSettingsModal.css';

const AdvancedSettingsModal = ({ 
  isOpen, 
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('info');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="advanced-settings-modal" 
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose}>
          <Icon name="close" type="png" size={24} />
        </button>

        <h2 className="settings-title">Дополнительные настройки</h2>

        {/* Табы */}
        <div className="settings-tabs">
          <button 
            className={`settings-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <Icon name="info" type="png" size={20} />
            <span>Информация</span>
          </button>
          <button 
            className={`settings-tab ${activeTab === 'future' ? 'active' : ''}`}
            onClick={() => setActiveTab('future')}
          >
            <Icon name="feature1" type="png" size={20} />
            <span>В "разработке"</span>
          </button>
          <button 
            className={`settings-tab ${activeTab === 'equalizer' ? 'active' : ''}`}
            onClick={() => setActiveTab('equalizer')}
          >
            <Icon name="equalizer" type="emoji" size={20} />
            <span>Эквалайзер</span>
          </button>
        </div>

        {/* Содержимое табов */}
        <div className="settings-content">
          {activeTab === 'info' && (
            <div className="info-content">
              <div className="info-header">
                <Icon name="musicNote" type="png" size={60} />
                <h3>Настройки звука</h3>
              </div>
              
              <div className="info-description">
                <p>
                  <strong>В данный момент настройки звука находятся в разработке - но это не точно.</strong>
                </p>
                <p>
                  Мы "работаем" над добавлением эквалайзера и усиления громкости, 
                  которые уже потерпели фиаско.
                </p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <Icon name="equalizer" type="png" size={24} />
                  <div className="feature-text">
                    <h4>Эквалайзер</h4>
                    <p>Настройка частот для идеального звучания - ПРОВАЛ <Icon name="close" type="png" size={14} /></p>
                  </div>
                </div>
                
                <div className="feature-item">
                  <Icon name="volumeOnMax" type="emoji" size={24} />
                  <div className="feature-text">
                    <h4>Усиление звука</h4>
                    <p>Увеличение громкости до 200% - ПРОВАЛ <Icon name="close" type="png" size={14} /></p>
                  </div>
                </div>
                
                <div className="feature-item">
                  <Icon name="feature2" type="png" size={24} />
                  <div className="feature-text">
                    <h4>Пресеты звука</h4>
                    <p>Сохранение настрокйи громкости при перезапуске - ВОЗМОЖНО <Icon name="warning" type="png" size={14} /></p>
                  </div>
                </div>
              </div>
              
              <div className="update-info">
                <Icon name="lightbulb" type="png" size={20} />
                <p>
                  <strong>Следите за обновлениями!</strong> Эти функции "появятся" в "следующих" версиях плеера.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'future' && (
            <div className="future-content">
              <div className="future-placeholder">
                <Icon name="feature2" type="png" size={80} />
                <h3>Новые функции "в разработке"</h3>
                <p>Этот раздел будет пополняться в будущих обновлениях.</p>
                
                <div className="future-features">
                  <div className="future-feature">
                    <Icon name="heartFilled" type="png" size={24} />
                    <span>Избранные треки - ВОЗМОЖНО <Icon name="warning" type="png" size={14} /></span>
                  </div>
                  <div className="future-feature">
                    <Icon name="account" type="png" size={24} />
                    <span>Система аккаунтов - ВОЗМОЖНО <Icon name="warning" type="png" size={14} /></span>
                  </div>
                  <div className="future-feature">
                    <Icon name="download" type="svg" size={24} />
                    <span>Автоматические обложки - ВОЗМОЖНО <Icon name="warning" type="png" size={14} /></span>
                  </div>
                  <div className="future-feature">
                    <Icon name="feature1" type="png" size={24} />
                    <span>Умные плейлисты - ВОЗМОЖНО <Icon name="warning" type="png" size={14} /></span>
                  </div>
                  <div className="future-feature">
                    <Icon name="musicNote" type="png" size={24} />
                    <span>Синхронизация текста песен - СКОРЕЕ НЕТ <Icon name="close" type="png" size={14} /></span>
                  </div>
                </div>
                
                <div className="coming-soon">
                  <span>Скоро... "но это не точно"</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equalizer' && (
            <div className="feature-text">
              <h4>Эквалайзер</h4>
              <p>Настройка частот и пресетов - ПРОВАЛЕНА БЕЗ УСПЕШНО <Icon name="close" type="png" size={14} /></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsModal;