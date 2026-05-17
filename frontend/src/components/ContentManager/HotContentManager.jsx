import React from 'react';
import Icon from '../Icon/Icon';

function HotContentManager() {
  return (
    <div className="content-panel">
      <div className="panel-header">
        <h2>Горячий контент</h2>
        <button className="add-btn">
          <Icon name="refresh" type="svg" size={16} />
          Обновить
        </button>
      </div>
      <div className="coming-soon-card">
        <Icon name="sparks" type="png" size={48} />
        <h3>Популярное и рекомендуемое</h3>
        <p>Здесь будет отображаться популярный контент на основе прослушиваний</p>
        <div className="feature-list">
          <span>🔥 Топ треков</span>
          <span>📈 Популярные плейлисты</span>
          <span>🎧 Рекомендации</span>
        </div>
      </div>
    </div>
  );
}

export default HotContentManager;