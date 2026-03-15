import React from 'react';
import Icon from '../Icon/Icon';

function MicControl({ isActive, onToggle }) {
  return (
    <button 
      className={`mic-btn ${isActive ? 'active' : ''}`}
      onClick={onToggle}
      title={isActive ? 'Выключить микрофон' : 'Включить микрофон'}
    >
      <Icon name="mic" type="emoji" size={24} />
      <span>{isActive ? 'Выключить микрофон' : 'Включить микрофон'}</span>
    </button>
  );
}

export default MicControl;