import React from 'react';
import Icon from '../Icon/Icon';

function FavouritesManager() {
  return (
    <div className="content-panel">
      <div className="panel-header">
        <h2>Избранное</h2>
        <button className="add-btn">
          <Icon name="refresh" type="svg" size={16} />
          Обновить
        </button>
      </div>
      <div className="coming-soon-card">
        <Icon name="heartFilled" type="png" size={48} />
        <h3>Любимые треки</h3>
        <p>Здесь будут отображаться треки, добавленные в избранное пользователем</p>
        <div className="feature-list">
          <span>❤️ Любимые треки</span>
          <span>📊 Статистика прослушиваний</span>
          <span>⭐ Оценки</span>
        </div>
      </div>
    </div>
  );
}

export default FavouritesManager;