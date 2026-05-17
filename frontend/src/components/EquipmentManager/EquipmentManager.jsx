import React from 'react';
import Icon from '../Icon/Icon';
import './EquipmentManager.css';

function EquipmentManager() {
  return (
    <div className="equipment-manager">
      <div className="coming-soon">
        <Icon name="speaker" type="emoji" size={64} />
        <h2>Управление оборудованием</h2>
        <p>Здесь будет управление ESP32 колонками (список устройств, статус, настройки).</p>
        <p className="hint">Функционал в разработке... 🚧</p>
      </div>
    </div>
  );
}

export default EquipmentManager;