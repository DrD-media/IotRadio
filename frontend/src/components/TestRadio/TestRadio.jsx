import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';

function TestRadio() {
  const [status, setStatus] = useState('Проверка...');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const streamUrl = `http://${window.location.hostname}:5000/api/radio/stream`;

  useEffect(() => {
    // Проверяем доступность бэкенда
    axios.get(`http://${window.location.hostname}:5000/api/radio/status`)
      .then(() => setStatus('✅ Бэкенд доступен'))
      .catch(err => setStatus(`❌ Ошибка: ${err.message}`));
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(streamUrl);
      audioRef.current.onplay = () => setIsPlaying(true);
      audioRef.current.onpause = () => setIsPlaying(false);
      audioRef.current.onerror = (e) => {
        console.error('Audio error:', e);
        alert('Ошибка воспроизведения');
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Play error:', err);
        alert('Не удалось воспроизвести поток');
      });
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🔧 Тест радио</h1>
      
      <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '10px' }}>
        <p><strong>Статус:</strong> {status}</p>
        <p><strong>Адрес потока:</strong> {streamUrl}</p>
        
        <button 
          onClick={togglePlay}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            background: isPlaying ? '#ff6b6b' : '#4ecdc4',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          {isPlaying ? '⏸️ Остановить' : '▶️ Слушать'}
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Инструкция:</h3>
        <ol>
          <li>Запусти бэкенд: <code>python backend/radio_stream.py</code></li>
          <li>Нажми кнопку "Слушать"</li>
          <li>Должен быть слышен тестовый сигнал (тон 440Hz)</li>
        </ol>
      </div>
    </div>
  );
}

export default TestRadio;