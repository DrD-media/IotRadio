from flask import Flask, send_file, jsonify, request, Response, render_template_string
from flask_cors import CORS
import os
import json
import threading
import queue
import time
import pyaudio
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ============================================
# ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ РАДИО
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Очередь для аудиопотока
audio_queue = queue.Queue(maxsize=100)

# Активные слушатели
active_listeners = set()
listeners_lock = threading.Lock()

# Текущее состояние радио
radio_state = {
    'is_live': False,
    'current_track': None,
    'current_playlist': None,
    'mic_active': False,
    'listeners_count': 0,
    'queue_size': 0
}

state_lock = threading.Lock()

# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================
def load_tracks_data():
    if not os.path.exists('music_data.json'):
        return {"tracks": []}
    with open('music_data.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def load_playlists():
    if not os.path.exists('playlists.json'):
        return {"playlists": []}
    with open('playlists.json', 'r', encoding='utf-8') as f:
        return json.load(f)

# ============================================
# КЛАСС ДЛЯ ЧТЕНИЯ MP3 ФАЙЛОВ
# ============================================
class MP3Player:
    def __init__(self):
        self.current_file = None
        self.file_handle = None
        self.is_playing = False
        self.lock = threading.Lock()
        
    def play_file(self, filepath):
        """Начинает воспроизведение MP3 файла"""
        with self.lock:
            if self.file_handle:
                self.file_handle.close()
            
            try:
                self.file_handle = open(filepath, 'rb')
                self.current_file = filepath
                self.is_playing = True
                print(f"Начато воспроизведение: {os.path.basename(filepath)}")
                return True
            except Exception as e:
                print(f"Ошибка открытия файла: {e}")
                return False
    
    def get_chunk(self, chunk_size=4096):
        """Получает следующий чанк MP3 данных"""
        with self.lock:
            if not self.is_playing or not self.file_handle:
                return None
            
            try:
                chunk = self.file_handle.read(chunk_size)
                if not chunk:  # Конец файла
                    self.is_playing = False
                    self.file_handle.close()
                    self.file_handle = None
                    return None
                return chunk
            except Exception as e:
                print(f"Ошибка чтения файла: {e}")
                self.is_playing = False
                return None
    
    def stop(self):
        """Останавливает воспроизведение"""
        with self.lock:
            self.is_playing = False
            if self.file_handle:
                self.file_handle.close()
                self.file_handle = None

# ============================================
# КЛАСС ДЛЯ ЗАХВАТА МИКРОФОНА
# ============================================
class MicrophoneCapture:
    def __init__(self):
        self.audio = None
        self.stream = None
        self.is_capturing = False
        self.chunk_queue = queue.Queue(maxsize=50)
        self.lock = threading.Lock()
        
    def start_capture(self):
        with self.lock:
            if self.is_capturing:
                return
                
            try:
                self.audio = pyaudio.PyAudio()
                self.stream = self.audio.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=44100,
                    input=True,
                    frames_per_buffer=1024,
                    stream_callback=self.audio_callback
                )
                self.stream.start_stream()
                self.is_capturing = True
                print("✅ Микрофон запущен")
            except Exception as e:
                print(f"❌ Ошибка запуска микрофона: {e}")
                
    def audio_callback(self, in_data, frame_count, time_info, status):
        if self.is_capturing:
            try:
                self.chunk_queue.put_nowait(in_data)
            except queue.Full:
                pass
        return (None, pyaudio.paContinue)
    
    def get_audio_chunk(self):
        try:
            return self.chunk_queue.get_nowait()
        except queue.Empty:
            return None
    
    def stop_capture(self):
        with self.lock:
            self.is_capturing = False
            print("Останавливаем микрофон...")
            
            # Очищаем очередь
            while not self.chunk_queue.empty():
                try:
                    self.chunk_queue.get_nowait()
                except queue.Empty:
                    break
            
            if self.stream:
                try:
                    self.stream.stop_stream()
                    self.stream.close()
                except:
                    pass
                self.stream = None
            
            if self.audio:
                try:
                    self.audio.terminate()
                except:
                    pass
                self.audio = None
            
            print("✅ Микрофон остановлен")

# Инициализация
mic = MicrophoneCapture()
mp3_player = MP3Player()

# ============================================
# ПОТОК ВЕЩАНИЯ
# ============================================
class RadioBroadcaster:
    def __init__(self):
        self.broadcast_thread = None
        self.is_broadcasting = False
        
    def start_broadcast(self):
        if self.is_broadcasting:
            return
            
        self.is_broadcasting = True
        self.broadcast_thread = threading.Thread(target=self._broadcast_loop)
        self.broadcast_thread.daemon = True
        self.broadcast_thread.start()
        print("🚀 Вещание запущено")
        
    def _broadcast_loop(self):
        """Главный цикл вещания"""
        while self.is_broadcasting:
            try:
                chunk_to_send = None
                
                # 1. Если играет трек - отправляем MP3
                if radio_state['current_track'] and mp3_player.is_playing:
                    chunk = mp3_player.get_chunk()
                    if chunk:
                        chunk_to_send = chunk
                    else:
                        # Трек закончился
                        with state_lock:
                            radio_state['current_track'] = None
                            radio_state['is_live'] = False
                
                # 2. Если микрофон активен, но трека нет - отправляем микрофон
                elif radio_state['mic_active']:
                    mic_chunk = mic.get_audio_chunk()
                    if mic_chunk:
                        # Для теста просто отправляем PCM как есть (браузер не поймет)
                        # В реальности нужно конвертировать в MP3
                        # Пока генерируем тестовый тон
                        import struct
                        import math
                        
                        # Генерируем тестовый сигнал (синусоида 440Hz)
                        sample_rate = 44100
                        frequency = 440
                        amplitude = 0.3
                        
                        samples = []
                        for i in range(1024):
                            t = float(i) / sample_rate
                            sample = amplitude * math.sin(2 * math.pi * frequency * t)
                            # Конвертируем в 16-bit PCM
                            packed = struct.pack('<h', int(sample * 32767))
                            samples.append(packed)
                        
                        chunk_to_send = b''.join(samples)
                
                # 3. Если ничего нет - отправляем тишину
                else:
                    # PCM тишина
                    chunk_to_send = b'\x00\x00' * 512
                
                if chunk_to_send:
                    audio_queue.put(chunk_to_send)
                    
            except Exception as e:
                print(f"Ошибка вещания: {e}")
            
            time.sleep(0.01)

broadcaster = RadioBroadcaster()

# ============================================
# API ЭНДПОИНТЫ
# ============================================

@app.route('/api/radio/stream')
def radio_stream():
    """ГЛАВНЫЙ ЭНДПОИНТ - аудиопоток для слушателей"""
    def generate():
        listener_id = id(threading.current_thread())
        
        with listeners_lock:
            active_listeners.add(listener_id)
            radio_state['listeners_count'] = len(active_listeners)
            print(f"👂 Слушатель подключился. Всего: {radio_state['listeners_count']}")
        
        # Запускаем вещание
        if not broadcaster.is_broadcasting:
            broadcaster.start_broadcast()
        
        try:
            while True:
                try:
                    # Пытаемся получить чанк из очереди
                    chunk = audio_queue.get(timeout=1.0)
                    yield chunk
                except queue.Empty:
                    # Если нет данных, отправляем тишину (короткий MP3 фрейм)
                    silence = b'\xff\xfb\x90\x44\x00\x00\x00\x00' * 25
                    yield silence
                    
        except GeneratorExit:
            with listeners_lock:
                active_listeners.discard(listener_id)
                radio_state['listeners_count'] = len(active_listeners)
                print(f"👋 Слушатель отключился. Всего: {radio_state['listeners_count']}")
    
    return Response(
        generate(),
        mimetype='audio/mpeg',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Accept-Ranges': 'none'
        }
    )

@app.route('/api/radio/play/<int:track_id>', methods=['POST'])
def radio_play(track_id):
    """DJ ставит трек в эфир"""
    tracks = load_tracks_data()
    track = next((t for t in tracks.get('tracks', []) if t['id'] == track_id), None)
    
    if not track:
        return jsonify({'error': 'Track not found'}), 404
    
    # Останавливаем текущее воспроизведение
    mp3_player.stop()
    
    # Начинаем новый трек
    filepath = os.path.join(BASE_DIR, 'music_files', track['filename'])
    if mp3_player.play_file(filepath):
        with state_lock:
            radio_state['current_track'] = track
            radio_state['is_live'] = True
        
        # Запускаем вещание
        if not broadcaster.is_broadcasting:
            broadcaster.start_broadcast()
        
        # Очищаем очередь от старых данных
        while not audio_queue.empty():
            try:
                audio_queue.get_nowait()
            except queue.Empty:
                break
    
    return jsonify({
        'success': True,
        'track': track,
        'listeners': radio_state['listeners_count']
    })

@app.route('/api/radio/mic', methods=['POST'])
def radio_mic():
    """Включение/выключение микрофона"""
    try:
        data = request.json
        action = data.get('action')
        
        with state_lock:
            if action == 'on' and not radio_state['mic_active']:
                threading.Thread(target=mic.start_capture, daemon=True).start()
                radio_state['mic_active'] = True
                print("🎤 Микрофон включен")
                
            elif action == 'off' and radio_state['mic_active']:
                threading.Thread(target=mic.stop_capture, daemon=True).start()
                radio_state['mic_active'] = False
                print("🎤 Микрофон выключен")
        
        return jsonify({'success': True, 'mic_active': radio_state['mic_active']})
        
    except Exception as e:
        print(f"Ошибка в radio_mic: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/radio/status')
def radio_status():
    """Статус радио для DJ"""
    with state_lock:
        with listeners_lock:
            return jsonify({
                'is_live': radio_state['is_live'],
                'current_track': radio_state['current_track'],
                'current_playlist': radio_state['current_playlist'],
                'mic_active': radio_state['mic_active'],
                'listeners': len(active_listeners),
                'queue_size': audio_queue.qsize()
            })

@app.route('/api/radio/stop', methods=['POST'])
def radio_stop():
    """Остановить эфир"""
    mp3_player.stop()
    with state_lock:
        radio_state['is_live'] = False
        radio_state['current_track'] = None
        radio_state['current_playlist'] = None
    
    # Очищаем очередь
    while not audio_queue.empty():
        try:
            audio_queue.get_nowait()
        except queue.Empty:
            break
    
    return jsonify({'success': True})

# ============================================
# СТАРЫЕ ЭНДПОИНТЫ
# ============================================
@app.route('/api/tracks')
def get_tracks():
    tracks = load_tracks_data()
    return jsonify(tracks.get('tracks', []))

@app.route('/api/playlists')
def get_playlists():
    playlists = load_playlists()
    return jsonify(playlists.get('playlists', []))

@app.route('/api/cover/<filename>')
def get_cover(filename):
    return send_file(os.path.join('covers', filename))

# ============================================
# ТЕХНИЧЕСКАЯ СТРАНИЦА
# ============================================
@app.route('/debug/radio')
def debug_radio():
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head>
        <title>📻 Техническая страница радио</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* ... CSS код из предыдущего сообщения ... */
        </style>
    </head>
    <body>
        <div class="debug-container">
            <h1><span>📻</span> Техническая страница радио</h1>
            <div class="badge">🔧 DEBUG MODE</div>
            
            <div class="stream-info">
                <div style="margin-bottom: 10px;">🎵 Прямой эфир</div>
                <div class="url-box" id="streamUrl"></div>
                <div class="status" id="streamStatus">
                    <span>⏳</span>
                    <span>Проверка соединения...</span>
                </div>
            </div>
            
            <audio id="audioPlayer" controls autoplay>
                <source src="/api/radio/stream" type="audio/mpeg">
                Ваш браузер не поддерживает аудио элемент.
            </audio>
            
            <div class="stats-grid" id="stats">
                <div class="stat-card">
                    <div class="stat-label">Слушателей</div>
                    <div class="stat-value" id="listeners">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Буфер</div>
                    <div class="stat-value" id="buffer">0</div>
                </div>
            </div>
            
            <div class="now-playing" id="nowPlaying">
                <h3>🎵 Сейчас в эфире</h3>
                <div class="title">Загрузка...</div>
                <div class="artist"></div>
                <div id="micStatus"></div>
            </div>
            
            <button class="refresh-btn" onclick="refreshStats()">
                🔄 Обновить информацию
            </button>
            
            <div class="footer-note">
                Техническая страница для отладки радио-потока
            </div>
        </div>
        
        <script>
            async function refreshStats() {
                try {
                    const response = await fetch('/api/radio/status');
                    const data = await response.json();
                    
                    document.getElementById('listeners').textContent = data.listeners || 0;
                    document.getElementById('buffer').textContent = data.queue_size || 0;
                    
                    const nowPlayingDiv = document.getElementById('nowPlaying');
                    if (data.current_track) {
                        nowPlayingDiv.innerHTML = `
                            <h3>🎵 Сейчас в эфире</h3>
                            <div class="title">${data.current_track.title || 'Неизвестно'}</div>
                            <div class="artist">${data.current_track.artist || 'Неизвестный исполнитель'}</div>
                            <div class="mic-indicator ${data.mic_active ? 'mic-on' : 'mic-off'}">
                                ${data.mic_active ? '🎤 Микрофон включен' : '🔇 Микрофон выключен'}
                            </div>
                        `;
                    } else {
                        nowPlayingDiv.innerHTML = `
                            <h3>🎵 Сейчас в эфире</h3>
                            <div class="title">${data.mic_active ? 'Микрофон активен' : 'Эфир не активен'}</div>
                            <div class="artist"></div>
                            <div class="mic-indicator ${data.mic_active ? 'mic-on' : 'mic-off'}">
                                ${data.mic_active ? '🎤 Микрофон включен' : '🔇 Микрофон выключен'}
                            </div>
                        `;
                    }
                    
                    const statusDiv = document.getElementById('streamStatus');
                    if (data.is_live || data.mic_active) {
                        statusDiv.innerHTML = `
                            <span>🔴</span>
                            <span class="live">Поток активен</span>
                        `;
                    } else {
                        statusDiv.innerHTML = `
                            <span>⭕</span>
                            <span style="color: #ff6b6b;">Поток остановлен</span>
                        `;
                    }
                    
                } catch (error) {
                    console.error('Ошибка:', error);
                }
            }
            
            window.onload = function() {
                const streamUrl = window.location.origin + '/api/radio/stream';
                document.getElementById('streamUrl').textContent = streamUrl;
                refreshStats();
                setInterval(refreshStats, 2000);
            };
            
            document.getElementById('audioPlayer').addEventListener('error', function(e) {
                console.error('Ошибка аудио:', e);
                const statusDiv = document.getElementById('streamStatus');
                statusDiv.innerHTML = `
                    <span>❌</span>
                    <span style="color: #ff6b6b;">Ошибка подключения</span>
                `;
            });
        </script>
    </body>
    </html>
    ''')

@app.route('/dj')
def dj_panel():
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head>
        <title>DJ Panel</title>
        <style>
            body { font-family: Arial; background: #1a1a2e; color: white; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            button { background: #e94560; color: white; border: none; padding: 10px; margin: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎧 DJ Panel</h1>
            <div id="status">Loading...</div>
            <button onclick="fetch('/api/radio/mic', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'on'})})">Mic ON</button>
            <button onclick="fetch('/api/radio/mic', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'off'})})">Mic OFF</button>
            <button onclick="fetch('/api/radio/stop', {method:'POST'})">STOP</button>
        </div>
        <script>
            setInterval(async() => {
                const res = await fetch('/api/radio/status');
                const data = await res.json();
                document.getElementById('status').innerHTML = `
                    <p>Live: ${data.is_live}</p>
                    <p>Mic: ${data.mic_active}</p>
                    <p>Listeners: ${data.listeners}</p>
                    <p>Track: ${data.current_track?.title || 'None'}</p>
                `;
            }, 1000);
        </script>
    </body>
    </html>
    ''')

if __name__ == '__main__':
    os.makedirs('music_files', exist_ok=True)
    os.makedirs('covers', exist_ok=True)
    
    print("="*50)
    print("🎧 RADIO SERVER STARTED")
    print("="*50)
    print("📻 Stream URL: http://localhost:5000/api/radio/stream")
    print("🎚️  DJ Panel: http://localhost:5000/dj")
    print("🔧 Debug Page: http://localhost:5000/debug/radio")
    print("="*50)
    
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)