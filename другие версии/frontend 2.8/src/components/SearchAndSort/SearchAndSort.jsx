import React, { useState, useEffect, useRef } from 'react';
import Icon from '../Icon/Icon';
import './SearchAndSort.css';

const SearchAndSort = ({ 
  tracks = [], 
  onSearchChange, 
  onSortChange,
  initialSearchType = "all",
  initialSortField = "id",
  initialSortDirection = "asc"
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState(initialSearchType);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [sortField, setSortField] = useState(initialSortField);
  const [sortDirection, setSortDirection] = useState(initialSortDirection);
  
  const dropdownRef = useRef(null);
  
  // Опции поиска
  const searchOptions = [
    { value: "all", label: "🔍 Общий поиск" },
    { value: "title", label: "🎵 По названию" },
    { value: "artist", label: "🎤 По автору" },
    { value: "date", label: "📅 По дате" },
    { value: "id", label: "#️⃣ По ID" }
  ];
  
  // Опции сортировки
  const sortOptions = [
    { field: "title", label: "Название" },
    { field: "artist", label: "Автор" },
    { field: "created_date", label: "Дата" }
  ];
  
  // Обработчик изменения поиска
  useEffect(() => {
    if (onSearchChange) {
      onSearchChange({
        query: searchQuery,
        type: searchType
      });
    }
  }, [searchQuery, searchType, onSearchChange]);
  
  // Обработчик изменения сортировки
  useEffect(() => {
    if (onSortChange) {
      onSortChange({
        field: sortField,
        direction: sortDirection
      });
    }
  }, [sortField, sortDirection, onSortChange]);
  
  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Получить текущую опцию поиска
  const getCurrentSearchOption = () => {
    return searchOptions.find(opt => opt.value === searchType) || searchOptions[0];
  };
  
  // Переключение сортировки по полю
  const handleSortClick = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Сброс сортировки
  const handleResetSort = () => {
    setSortField("id");
    setSortDirection("asc");
  };
  
  // Получить подсказку для поиска
  const getSearchPlaceholder = () => {
    switch (searchType) {
      case "title": return "Введите название трека...";
      case "artist": return "Введите имя автора...";
      case "date": return "Введите дату (ГГГГ-ММ-ДД)...";
      case "id": return "Введите ID трека...";
      default: return "Искать по всем данным...";
    }
  };
  
  return (
    <div className="search-sort-container">
      {/* Левая секция - Поиск */}
      <div className="search-section">
        <div className="search-type-selector" ref={dropdownRef}>
          <button 
            className="search-type-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Выберите тип поиска"
          >
            <span className="search-type-label">
              {getCurrentSearchOption().label}
            </span>
            <Icon 
              name={isDropdownOpen ? "listUp" : "listDown"} 
              type="svg" 
              size={16} 
            />
          </button>
          
          {isDropdownOpen && (
            <div className="search-type-dropdown">
              {searchOptions.map(option => (
                <button
                  key={option.value}
                  className={`search-type-option ${searchType === option.value ? 'active' : ''}`}
                  onClick={() => {
                    setSearchType(option.value);
                    setIsDropdownOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery("");
            }}
          />
          {searchQuery ? (
            <button 
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              title="Очистить поиск"
            >
              <Icon name="close" type="png" size={16} />
            </button>
          ) : (
            <Icon name="search" type="svg" size={20} className="search-icon" />
          )}
        </div>
        
        {/* Статистика поиска */}
        {searchQuery && (
          <div className="search-stats">
            <span className="search-stats-text">
              Найдено: {tracks.length} треков
            </span>
          </div>
        )}
      </div>
      
      {/* Правая секция - Сортировка */}
      <div className="sort-section">
        <div className="sort-buttons">
          <button 
            className="sort-reset-btn"
            onClick={handleResetSort}
            title="Сбросить сортировку"
          >
            <Icon name="refresh" type="svg" size={18} />
            <span>Сбросить</span>
          </button>
          {sortOptions.map(option => (
            <button
              key={option.field}
              className={`sort-btn ${sortField === option.field ? 'active' : ''}`}
              onClick={() => handleSortClick(option.field)}
              title={`Сортировать по ${option.label}`}
            >
              <span>{option.label}</span>
              {sortField === option.field && (
                <Icon 
                  name={sortDirection === "asc" ? "arrowUp" : "arrowDown"} 
                  type="svg" 
                  size={14} 
                />
              )}
            </button>
          ))}
        </div>
        
        {/* Индикатор текущей сортировки */}
        <div className="sort-indicator">
          <span className="sort-indicator-text">
            Сортировка: 
            <span className="sort-field">
              {sortOptions.find(o => o.field === sortField)?.label || "без сортировки"} 
            </span>
            {sortField !== "id" && (
              <Icon 
                name={sortDirection === "asc" ? "arrowUp" : "arrowDown"} 
                type="svg" 
                size={14} 
                className="sort-direction-icon"
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchAndSort;