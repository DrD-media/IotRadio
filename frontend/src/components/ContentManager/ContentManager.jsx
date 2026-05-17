import React, { useState } from 'react';
import Icon from '../Icon/Icon';
import TracksManager from './TracksManager';
import PlaylistsManager from './PlaylistsManager';
import FavouritesManager from './FavouritesManager';
import HotContentManager from './HotContentManager';
import './ContentManager.css';

function ContentManager() {
  const [activeTab, setActiveTab] = useState('tracks'); // tracks, playlists, favourites, hot

  const renderContent = () => {
    switch (activeTab) {
      case 'tracks':
        return <TracksManager />;
      case 'playlists':
        return <PlaylistsManager />;
      case 'favourites':
        return <FavouritesManager />;
      case 'hot':
        return <HotContentManager />;
      default:
        return null;
    }
  };

  return (
    <div className="content-manager">
      <div className="content-manager-container">
        {/* Вкладки */}
        <div className="content-tabs">
          <button 
            className={`content-tab-btn ${activeTab === 'tracks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracks')}
          >
            <Icon name="musicNote" type="emoji" size={18} />
            Треки
          </button>
          <button 
            className={`content-tab-btn ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => setActiveTab('playlists')}
          >
            <Icon name="list" type="emoji" size={18} />
            Плейлисты
          </button>
          <button 
            className={`content-tab-btn ${activeTab === 'favourites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favourites')}
          >
            <Icon name="heartFilled" type="png" size={18} />
            Избранное
          </button>
          <button 
            className={`content-tab-btn ${activeTab === 'hot' ? 'active' : ''}`}
            onClick={() => setActiveTab('hot')}
          >
            <Icon name="sparks" type="png" size={18} />
            Горячий контент
          </button>
        </div>

        {/* Контент */}
        <div className="content-tab-panels">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default ContentManager;