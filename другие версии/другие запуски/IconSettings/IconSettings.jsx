import React, { useState } from 'react';
import { useIcon } from '../../icons/useIcon';

const IconSettings = () => {
  const [iconType, setIconType] = useState('svg'); // 'svg' | 'png' | 'emoji'
  const [iconSize, setIconSize] = useState('md'); // 'sm' | 'md' | 'lg' | 'xl'
  
  const { getIcon } = useIcon();
  
  const sizeMap = {
    sm: 18,
    md: 24,
    lg: 28,
    xl: 32,
  };
  
  return (
    <div className="icon-settings">
      <h4>Настройки иконок</h4>
      
      <div className="icon-type-selector">
        <label>
          <input 
            type="radio" 
            value="svg" 
            checked={iconType === 'svg'}
            onChange={(e) => setIconType(e.target.value)}
          />
          SVG
        </label>
        
        <label>
          <input 
            type="radio" 
            value="png" 
            checked={iconType === 'png'}
            onChange={(e) => setIconType(e.target.value)}
          />
          PNG
        </label>
        
        <label>
          <input 
            type="radio" 
            value="emoji" 
            checked={iconType === 'emoji'}
            onChange={(e) => setIconType(e.target.value)}
          />
          Emoji
        </label>
      </div>
      
      <div className="icon-size-selector">
        <select value={iconSize} onChange={(e) => setIconSize(e.target.value)}>
          <option value="sm">Маленькие (18px)</option>
          <option value="md">Средние (24px)</option>
          <option value="lg">Большие (28px)</option>
          <option value="xl">Очень большие (32px)</option>
        </select>
      </div>
      
      <div className="icon-preview">
        <h5>Предпросмотр:</h5>
        <div>
          {getIcon('play', { type: iconType, size: sizeMap[iconSize] })}
          {getIcon('pause', { type: iconType, size: sizeMap[iconSize] })}
          {getIcon('heart', { type: iconType, size: sizeMap[iconSize] })}
          {getIcon('download', { type: iconType, size: sizeMap[iconSize] })}
        </div>
      </div>
    </div>
  );
};

export default IconSettings;