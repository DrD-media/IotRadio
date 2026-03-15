import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import './App.css'

// Импортируем компонент Icon
import Icon from './components/Icon/Icon.jsx'

// Импортируем компоненты
import MainPlayer from "./components/MainPlayer/MainPlayer";
import TrackList from "./components/TrackList/TrackList";
import AdvancedSettingsModal from './components/AdvancedSettingsModal/AdvancedSettingsModal';

function App() {
  const [tracks, setTracks] = useState([])
  const [filteredTracks, setFilteredTracks] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [loopPlaylist, setLoopPlaylist] = useState(true)
  const [loopTrack, setLoopTrack] = useState(false)
  
  const audioRef = useRef(null)
  
  // Базовый URL для бэкенда
  // const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  
  // Используйте относительные пути:
  const API_URL = ''; // Пустая строка - все пути относительные

  // Текущий год для футера
  const currentYear = new Date().getFullYear();
  
  // Загружаем список треков при старте
  useEffect(() => {
    let isMounted = true
    
    const fetchTracks = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await axios.get(`${API_URL}/api/tracks`)
        if (isMounted) {
          const tracksWithLikes = response.data.map(track => ({
            ...track,
            liked: false
          }))
          setTracks(tracksWithLikes)
          if (tracksWithLikes.length > 0) {
            setCurrentTrack(prev => prev || tracksWithLikes[0])
          }
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error loading tracks:', error)
        if (isMounted) {
          setError('Не удалось загрузить треки. Проверьте бэкенд.')
          setIsLoading(false)
        }
      }
    }
    
    fetchTracks()
    
    return () => {
      isMounted = false
    }
  }, [API_URL])

  // Тема оформления
  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.add('dark-theme')
    } else {
      document.body.classList.remove('dark-theme')
    }
  }, [isDarkTheme])

  // Функция для перезагрузки треков
  const reloadTracks = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(`${API_URL}/api/tracks`)
      const tracksWithLikes = response.data.map(track => ({
        ...track,
        liked: track.liked || false,
        cover: track.cover || `https://picsum.photos/seed/${track.id}/300/300`
      }))
      setTracks(tracksWithLikes)
      if (tracksWithLikes.length > 0 && !currentTrack) {
        setCurrentTrack(tracksWithLikes[0])
      }
      setIsLoading(false)
      setError(null)
    } catch (error) {
      console.error('Error reloading tracks:', error)
      setError('Ошибка при обновлении списка треков')
      setIsLoading(false)
    }
  }

  const handleTrackSelect = useCallback((track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
    
    if (audioRef.current) {
      audioRef.current.src = `${API_URL}/api/play/${track.file}`
      audioRef.current.volume = isMuted ? 0 : volume
      audioRef.current.load()
      audioRef.current.play().catch(e => console.log("Autoplay blocked:", e))
    }
  }, [isMuted, volume])  // Убрали API_URL из зависимостей
  
  const togglePlayPause = () => {
    if (!currentTrack) return
    
    if (!audioRef.current.src && currentTrack.file) {
      audioRef.current.src = `/api/play/${currentTrack.file}`
      audioRef.current.volume = isMuted ? 0 : volume
    }
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(e => {
        console.log("Play failed:", e)
        setIsPlaying(false)
      })
    }
    setIsPlaying(!isPlaying)
  }
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTimeValue = audioRef.current.currentTime
      const durationValue = audioRef.current.duration || 0
      const progressPercent = durationValue > 0 ? (currentTimeValue / durationValue) * 100 : 0
      setCurrentTime(currentTimeValue)
      setDuration(durationValue)
      setProgress(progressPercent)
    }
  }
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0)
      setProgress(0)
      setCurrentTime(0)
    }
  }
  
  const handleProgressClick = (e) => {
    if (!audioRef.current || !currentTrack || duration === 0) return
    
    const progressBar = e.currentTarget
    const clickPosition = e.clientX - progressBar.getBoundingClientRect().left
    const progressBarWidth = progressBar.clientWidth
    const percent = clickPosition / progressBarWidth
    
    const newTime = duration * percent
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
    setProgress(percent * 100)
  }
  
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      setVolume(prevVolume)
      if (audioRef.current) {
        audioRef.current.volume = prevVolume
      }
    } else {
      setIsMuted(true)
      setPrevVolume(volume)
      setVolume(0)
      if (audioRef.current) {
        audioRef.current.volume = 0
      }
    }
  }
  
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
      setPrevVolume(newVolume)
    }
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }
  
  const handleNextTrack = useCallback(() => {
    if (!currentTrack || filteredTracks.length === 0) return
    
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % filteredTracks.length
    handleTrackSelect(filteredTracks[nextIndex])
  }, [currentTrack, filteredTracks, handleTrackSelect])
  
  const handlePrevTrack = useCallback(() => {
    if (!currentTrack || filteredTracks.length === 0) return
    
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id)
    const prevIndex = currentIndex === 0 ? filteredTracks.length - 1 : currentIndex - 1
    handleTrackSelect(filteredTracks[prevIndex])
  }, [currentTrack, filteredTracks, handleTrackSelect])

  // Скачивание трека
  const handleDownloadTrack = async (track, e) => {
    e.stopPropagation()
    if (track && track.file) {
      try {
        const downloadUrl = `${API_URL}/api/play/${track.file}`
        const response = await fetch(downloadUrl)
        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.status}`)
        }
        
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = track.file
        link.style.display = 'none'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        window.URL.revokeObjectURL(blobUrl)
        
        console.log(`Трек "${track.title}" скачивается`)
      } catch (error) {
        console.error('Ошибка при скачивании трека:', error)
        alert('Не удалось скачать трек. Проверьте подключение к серверу.')
      }
    }
  }

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  const handleAccount = () => {
    alert('Вход в аккаунт: Система авторизации в разработке')
  }

  // Функция для лайка трека
  const handleLikeTrack = (trackId, e) => {
    e.stopPropagation()
    
    setTracks(prevTracks => 
      prevTracks.map(track => 
        track.id === trackId ? { ...track, liked: !track.liked } : track
      )
    )
    
    if (currentTrack && currentTrack.id === trackId) {
      setCurrentTrack(prev => ({ ...prev, liked: !prev.liked }))
    }
  }

  // Переключение режима повтора плейлиста
  const toggleLoopPlaylist = () => {
    setLoopPlaylist(!loopPlaylist)
    if (!loopPlaylist && loopTrack) {
      setLoopTrack(false)
    }
  }

  // Переключение режима повтора одного трека
  const toggleLoopTrack = () => {
    setLoopTrack(!loopTrack)
    if (!loopTrack && loopPlaylist) {
      setLoopPlaylist(false)
    }
  }

  // Обработка окончания трека
  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement) return

    const handleTrackEnd = () => {
      if (loopTrack && currentTrack) {
        audioElement.currentTime = 0
        audioElement.play().catch(e => console.log("Play failed:", e))
      } else if (loopPlaylist) {
        handleNextTrack()
      } else {
        setIsPlaying(false)
      }
    }

    audioElement.addEventListener('ended', handleTrackEnd)

    return () => {
      audioElement.removeEventListener('ended', handleTrackEnd)
    }
  }, [currentTrack, loopPlaylist, loopTrack, handleNextTrack])

// Обработка ошибок загрузки иконок (добавьте в конец компонента App, перед return)
useEffect(() => {
  const handleImageError = (e) => {
    const img = e.target;
    const fallback = img.nextElementSibling;
    
    if (fallback && fallback.classList.contains('icon-emoji')) {
      // Показываем эмодзи если изображение не загрузилось
      img.style.display = 'none';
      fallback.style.display = 'inline-block';
      console.warn(`Иконка не загрузилась: ${img.src}`);
    }
  };
  
  // Вешаем обработчик на все иконки
  document.querySelectorAll('.icon').forEach(img => {
    img.addEventListener('error', handleImageError);
  });
  
  return () => {
    document.querySelectorAll('.icon').forEach(img => {
      img.removeEventListener('error', handleImageError);
    });
  };
}, []);

  return (
    <>
      <div className="App">
        <header className="App-header">
          <div className="header-left">
            <div className="logo">DrD Life</div>
          </div>

          <div className="header-center">
            <h1><Icon name="musicNote" type="png" size={20} /> Мой Музыкальный Плеер</h1>
          </div>

          <div className="header-right">   
            <button 
                    className="settings-btn"
                    onClick={() => setIsSettingsModalOpen(true)}
                    title="Дополнительные настройки"
                  >
                    <Icon name="sparks" type="png" size={20} />
                  </button>

            <button 
              onClick={toggleTheme} 
              className="header-btn theme-btn"
              title={isDarkTheme ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            >
              <Icon 
                // name={isDarkTheme ? "themeLight" : "themeDark"} 
                name={isDarkTheme ? "themeDark" : "themeLight"} 
                type="png" 
                size={20} 
              />
              {/* <span className="btn-text">{isDarkTheme ? 'Светлая' : 'Тёмная'}</span> */}
              <span className="btn-text">{isDarkTheme ? 'Тёмная' : 'Светлая'}</span>
            </button>

            <button 
              onClick={handleAccount} 
              className="header-btn account-btn small"
              title="Аккаунт"
            >
              <Icon name="account" type="png" size={22} />
            </button>
          </div>
        </header>

        <main className="player-container">
          {/* <div className="sidebar"></div> */}
          {/* <div className="player-container"> */}
          <MainPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            volume={volume}
            isMuted={isMuted}
            loopTrack={loopTrack}
            loopPlaylist={loopPlaylist}
            onPlayPause={togglePlayPause}
            onNextTrack={handleNextTrack}
            onPrevTrack={handlePrevTrack}
            onVolumeChange={handleVolumeChange}
            onToggleMute={toggleMute}
            onProgressClick={handleProgressClick}
            onLikeTrack={handleLikeTrack}
            onToggleLoopTrack={toggleLoopTrack}
            currentTime={currentTime}
            duration={duration}
            progress={progress}
            API_URL={API_URL}
          />
          <TrackList
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            isLoading={isLoading}
            error={error}
            loopPlaylist={loopPlaylist}
            onTrackSelect={handleTrackSelect}
            onLikeTrack={handleLikeTrack}
            onDownloadTrack={handleDownloadTrack}
            onReloadTracks={reloadTracks}
            onToggleLoopPlaylist={toggleLoopPlaylist}
            onSetFilteredTracks={setFilteredTracks}
            API_URL={API_URL}
          />
          {/* </div> */}
        </main>

        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={(e) => console.error("Audio error:", e)}
        />

        <footer className="footer">
          <div className="footer-left">
            <div className="footer-year">{currentYear}</div>
          </div>

          <div className="footer-center">
            <p>Сделано с React (Vite) + Python (Flask)</p>
            {/* <div className="debug-info">
              API: <code>{API_URL}</code> | 
              {// API: <code>{API_BASE_URL || 'localhost (proxy)'}</code> | 
              }
              Треков: {tracks.length} | 
              Громкость: {isMuted ? '0%' : `${Math.round(volume * 100)}%`} |
              Тема: {isDarkTheme ? 'Тёмная' : 'Светлая'} |
              Повтор: {loopTrack ? 'Трека' : loopPlaylist ? 'Списка' : 'Нет'} |
              {isLoading && ' ⏳ Загрузка...'}
            </div> */}
          </div>
          <div className="footer-right">
            <div className="footer-logo">DrD Life</div>
          </div>
        </footer>
      </div>
            
      {/* Модальные окна */}
        <AdvancedSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          volume={volume}
        />
    </>
  )
}

export default App