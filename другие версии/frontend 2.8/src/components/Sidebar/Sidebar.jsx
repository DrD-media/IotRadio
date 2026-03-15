// frontend/src/components/Sidebar/Sidebar.jsx
import React from 'react';
import Icon from '../Icon/Icon';
import './Sidebar.css';

const Sidebar = ({ 
  activePage = 'music', 
  onPageChange, 
  isCollapsed = false 
}) => {
  
  const navItems = [
    {
      id: 'music',
      title: 'Музыка',
      icon: 'musicNote',
      activeColor: '#667eea',
      description: 'Музыкальный плеер'
    },
    {
      id: 'video',
      title: 'Видео',
      icon: 'feature1',
      activeColor: '#ff6b6b',
      description: 'Видео контент'
    },
    {
      id: 'news',
      title: 'Новости',
      icon: 'info',
      activeColor: '#764ba2',
      description: 'Новости проекта'
    },
    {
      id: 'more',
      title: 'Другое',
      icon: 'feature2',
      activeColor: '#4CAF50',
      description: 'Дополнительно'
    }
  ];

  const handleItemClick = (itemId) => {
    if (onPageChange) {
      onPageChange(itemId);
    }
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="sidebar-content">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => handleItemClick(item.id)}
            style={{
              '--active-color': item.activeColor
            }}
          >
            <div className="sidebar-item-icon">
              <Icon 
                name={item.icon} 
                type="png" 
                size={22}
                color={activePage === item.id ? item.activeColor : 'rgba(255, 255, 255, 0.7)'}
              />
            </div>
            
            <div className="sidebar-item-text">
              <div className="sidebar-item-title">{item.title}</div>
              {!isCollapsed && (
                <div className="sidebar-item-description">{item.description}</div>
              )}
            </div>
            
            {/* Индикатор активной страницы */}
            {activePage === item.id && (
              <div 
                className="sidebar-active-indicator" 
                style={{ backgroundColor: item.activeColor }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;