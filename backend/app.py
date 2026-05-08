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
    'queue_size': 0,
    'mixer_enabled': False   # ← НОВЫЙ ФЛАГ ДЛЯ МИКШЕРА
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
        self.is_playing = False
        self.converter_thread = None
        self.converter = None
        self.chunk_queue = queue.Queue(maxsize=200)
        
    def play_file(self, filepath):
        """Начинает воспроизведение MP3 файла с конвертацией в PCM"""
        self.stop()
        
        try:
            import subprocess
            
            cmd = [
                'ffmpeg',
                '-i', filepath,
                '-f', 's16le',
                '-acodec', 'pcm_s16le',
                '-ar', '44100',
                '-ac', '2',
                '-loglevel', 'error',
                '-'
            ]
            
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=8192
            )
            
            self.is_playing = True
            self.current_file = filepath
            self.reader_thread = threading.Thread(target=self._read_output, daemon=True)
            self.reader_thread.start()
            
            print(f"🎵 Начато воспроизведение: {os.path.basename(filepath)} (PCM 44.1kHz)")
            return True
            
        except Exception as e:
            print(f"Ошибка открытия файла: {e}")
            return False
    
    def _read_output(self):
        while self.is_playing and self.process:
            try:
                chunk = self.process.stdout.read(4096)
                if not chunk:
                    break
                self.chunk_queue.put(chunk)
            except Exception as e:
                print(f"Ошибка чтения: {e}")
                break
        
        print(f"📢 Воспроизведение закончено: {self.current_file}")
        self.is_playing = False
    
    def get_chunk(self, timeout=0.01):
        if not self.is_playing:
            return None
        try:
            return self.chunk_queue.get(timeout=timeout)
        except queue.Empty:
            return None
    
    def stop(self):
        self.is_playing = False
        
        if hasattr(self, 'process') and self.process:
            try:
                self.process.terminate()
                self.process = None
            except:
                pass
        
        while not self.chunk_queue.empty():
            try:
                self.chunk_queue.get_nowait()
            except queue.Empty:
                break

# ============================================
# КЛАСС ДЛЯ ЗАХВАТА МИКРОФОНА
# ============================================
class MicrophoneCapture:
    def __init__(self):
        self.audio = None
        self.stream = None
        self.is_capturing = False
        self.chunk_queue = queue.Queue(maxsize=100)
        self.lock = threading.Lock()
        
    def start_capture(self):
        with self.lock:
            if self.is_capturing:
                return
                
            try:
                self.audio = pyaudio.PyAudio()
                
                print("Доступные аудиоустройства:")
                for i in range(self.audio.get_device_count()):
                    info = self.audio.get_device_info_by_index(i)
                    if info['maxInputChannels'] > 0:
                        print(f"  [{i}] {info['name']} (входов: {info['maxInputChannels']})")
                
                self.stream = self.audio.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=44100,
                    input=True,
                    input_device_index=None,
                    frames_per_buffer=1024,
                    stream_callback=self.audio_callback
                )
                self.stream.start_stream()
                self.is_capturing = True
                print("✅ Микрофон запущен")
            except Exception as e:
                print(f"❌ Ошибка запуска микрофона: {e}")
                
    def audio_callback(self, in_data, frame_count, time_info, status):
        if self.is_capturing and in_data:
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

mic = MicrophoneCapture()

# ============================================
# КЛАСС AudioMixer (НОВЫЙ)
# ============================================
class AudioMixer:
    def __init__(self, music_gain=0.6, mic_gain=0.8):
        self.music_gain = music_gain
        self.mic_gain = mic_gain
        
    def mono_to_stereo(self, mono_chunk):
        """Конвертирует моно PCM в стерео"""
        if not mono_chunk:
            return None
        stereo = bytearray()
        for i in range(0, len(mono_chunk), 2):
            sample = mono_chunk[i:i+2]
            stereo.extend(sample)
            stereo.extend(sample)
        return bytes(stereo)
    
    def mix(self, music_chunk, mic_chunk):
        """Микширует музыку и микрофон"""
        if not music_chunk and not mic_chunk:
            return b'\x00\x00' * 1024
        
        if not music_chunk and mic_chunk:
            return self.mono_to_stereo(mic_chunk)
        
        if music_chunk and not mic_chunk:
            return music_chunk
        
        # Микширование
        mic_stereo = self.mono_to_stereo(mic_chunk)
        if not mic_stereo:
            return music_chunk
        
        # Выравниваем длину
        min_len = min(len(music_chunk), len(mic_stereo))
        
        mixed = bytearray()
        for i in range(0, min_len, 2):
            music_sample = int.from_bytes(music_chunk[i:i+2], 'little', signed=True)
            mic_sample = int.from_bytes(mic_stereo[i:i+2], 'little', signed=True)
            
            val = int(music_sample * self.music_gain + mic_sample * self.mic_gain)
            val = max(-32768, min(32767, val))
            mixed.extend(val.to_bytes(2, 'little', signed=True))
        
        # Добавляем остаток музыки
        if len(music_chunk) > min_len:
            mixed.extend(music_chunk[min_len:])
        
        return bytes(mixed)

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
        
        # Выбираем режим работы
        if radio_state.get('mixer_enabled', False):
            target = self._broadcast_loop_mixer
            print("🎛️ Режим МИКШЕРА включён")
        else:
            target = self._broadcast_loop
            print("🎛️ Режим РАЗДЕЛЬНОЙ работы включён")
        
        self.broadcast_thread = threading.Thread(target=target)
        self.broadcast_thread.daemon = True
        self.broadcast_thread.start()
        print("🚀 Вещание запущено")
    
    def normalize_audio(self, stereo_chunk, gain=3.0):
        if not stereo_chunk:
            return stereo_chunk
        
        samples = []
        for i in range(0, len(stereo_chunk), 2):
            sample = int.from_bytes(stereo_chunk[i:i+2], 'little', signed=True)
            sample = int(sample * gain)
            sample = max(-32768, min(32767, sample))
            samples.append(sample)
        
        result = bytearray()
        for sample in samples:
            result.extend(sample.to_bytes(2, 'little', signed=True))
        return bytes(result)
    
    # ========== ОРИГИНАЛЬНЫЙ ЦИКЛ (РАЗДЕЛЬНЫЙ) ==========
    def _broadcast_loop(self):
        """Главный цикл вещания (оригинальный)"""
        while self.is_broadcasting:
            try:
                chunk_to_send = None

                if radio_state['current_track'] and mp3_player.is_playing:
                    chunk = mp3_player.get_chunk()
                    if chunk:
                        chunk_to_send = chunk
                    else:
                        if not mp3_player.is_playing:
                            with state_lock:
                                radio_state['current_track'] = None
                                radio_state['is_live'] = False

                elif radio_state['mic_active']:
                    mic_chunk = mic.get_audio_chunk()
                    if mic_chunk and len(mic_chunk) > 0:
                        stereo_chunk = bytearray()
                        for i in range(0, len(mic_chunk), 2):
                            sample = mic_chunk[i:i+2]
                            stereo_chunk.extend(sample)
                            stereo_chunk.extend(sample)
                        chunk_to_send = self.normalize_audio(bytes(stereo_chunk), gain=0.9)
                    else:
                        chunk_to_send = b'\x00\x00' * 1024
                else:
                    chunk_to_send = b'\x00\x00' * 1024

                if chunk_to_send:
                    remainder = len(chunk_to_send) % 4
                    if remainder != 0:
                        chunk_to_send += b'\x00' * (4 - remainder)
                    audio_queue.put(chunk_to_send)

            except Exception as e:
                print(f"Ошибка вещания: {e}")

            time.sleep(0.005)
    
    # ========== НОВЫЙ ЦИКЛ (МИКШИРОВАНИЕ) ==========
    def _broadcast_loop_mixer(self):
        """Цикл вещания с микшированием (НОВЫЙ)"""
        mixer = AudioMixer(music_gain=0.6, mic_gain=1.2)
        
        while self.is_broadcasting:
            try:
                music_chunk = None
                mic_chunk = None
                
                # ⭐ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: получаем чанк даже если трек не играет
                if radio_state['current_track']:
                    chunk = mp3_player.get_chunk()
                    if chunk:
                        music_chunk = chunk
                    else:
                        # Если чанков нет, возможно трек закончился
                        if not mp3_player.is_playing:
                            with state_lock:
                                radio_state['current_track'] = None
                                radio_state['is_live'] = False
                
                if radio_state['mic_active']:
                    mic_chunk = mic.get_audio_chunk()
                
                chunk_to_send = mixer.mix(music_chunk, mic_chunk)
                
                # Добиваем до кратности 4
                remainder = len(chunk_to_send) % 4
                if remainder != 0:
                    chunk_to_send += b'\x00' * (4 - remainder)
                
                audio_queue.put(chunk_to_send)
                
            except Exception as e:
                print(f"Ошибка вещания (микшер): {e}")
            
            time.sleep(0.005)

mp3_player = MP3Player()
broadcaster = RadioBroadcaster()

# ============================================
# API ЭНДПОИНТЫ
# ============================================

@app.route('/api/radio/stream')
def radio_stream():
    def generate():
        listener_id = id(threading.current_thread())
        
        with listeners_lock:
            active_listeners.add(listener_id)
            radio_state['listeners_count'] = len(active_listeners)
            print(f"👂 Слушатель подключился. Всего: {radio_state['listeners_count']}")
        
        if not broadcaster.is_broadcasting:
            broadcaster.start_broadcast()
        
        try:
            while True:
                try:
                    chunk = audio_queue.get(timeout=0.5)
                    yield chunk
                except queue.Empty:
                    silence = b'\x00\x00' * 1024
                    yield silence
                    
        except GeneratorExit:
            with listeners_lock:
                active_listeners.discard(listener_id)
                radio_state['listeners_count'] = len(active_listeners)
                print(f"👋 Слушатель отключился. Всего: {radio_state['listeners_count']}")
    
    return Response(
        generate(),
        mimetype='audio/L16',
        headers={
            'Cache-Control': 'no-cache',
            'Content-Type': 'audio/L16; rate=44100; channels=2',
            'Connection': 'keep-alive'
        }
    )

@app.route('/api/radio/play/<int:track_id>', methods=['POST'])
def radio_play(track_id):
    tracks = load_tracks_data()
    track = next((t for t in tracks.get('tracks', []) if t['id'] == track_id), None)
    
    if not track:
        return jsonify({'error': 'Track not found'}), 404
    
    # Останавливаем текущее воспроизведение
    mp3_player.stop()
    
    # Очищаем очередь от старых данных
    while not audio_queue.empty():
        try:
            audio_queue.get_nowait()
        except queue.Empty:
            break
    
    # ⭐ КРИТИЧЕСКИ ВАЖНО: отправляем тишину и маркер для сброса ESP32
    silence_duration_ms = 200
    silence_samples = int(44100 * silence_duration_ms / 1000) * 2 * 2
    silence_chunk = b'\x00\x00' * silence_samples
    audio_queue.put(silence_chunk)
    
    end_marker = b'\xDE\xAD\xBE\xEF'
    audio_queue.put(end_marker)
    
    # Начинаем новый трек
    filepath = os.path.join(BASE_DIR, 'music_files', track['filename'])
    if mp3_player.play_file(filepath):
        with state_lock:
            radio_state['current_track'] = track
            radio_state['is_live'] = True
        
        # Запускаем вещание (если ещё не запущено)
        if not broadcaster.is_broadcasting:
            broadcaster.start_broadcast()
    
    return jsonify({
        'success': True,
        'track': track,
        'listeners': radio_state['listeners_count']
    })

@app.route('/api/radio/mic', methods=['POST'])
def radio_mic():
    try:
        data = request.json
        action = data.get('action')
        
        with state_lock:
            if action == 'on' and not radio_state['mic_active']:
                threading.Thread(target=mic.start_capture, daemon=True).start()
                radio_state['mic_active'] = True
                
                time.sleep(0.5)
                silence_duration_ms = 1000
                silence_samples = int(44100 * silence_duration_ms / 1000) * 2 * 2
                silence_chunk = b'\x00\x00' * silence_samples
                audio_queue.put(silence_chunk)
                
                end_marker = b'\xDE\xAD\xBE\xEF'
                audio_queue.put(end_marker)
                audio_queue.put(end_marker)
                
                print("🎤 Микрофон включен")
                
            elif action == 'off' and radio_state['mic_active']:
                threading.Thread(target=mic.stop_capture, daemon=True).start()
                radio_state['mic_active'] = False

                while not audio_queue.empty():
                    try:
                        audio_queue.get_nowait()
                    except queue.Empty:
                        break

                print("🎤 Микрофон выключен")
        
        return jsonify({'success': True, 'mic_active': radio_state['mic_active']})
        
    except Exception as e:
        print(f"Ошибка в radio_mic: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/radio/mixer', methods=['POST'])
def radio_mixer():
    """Включение/выключение режима микширования"""
    try:
        data = request.json
        enable = data.get('enable', False)
        
        with state_lock:
            radio_state['mixer_enabled'] = enable
        
        # Перезапускаем вещание с новым режимом
        old_broadcasting = broadcaster.is_broadcasting
        broadcaster.is_broadcasting = False
        time.sleep(0.2)  # Даём время на остановку
        
        broadcaster.is_broadcasting = True
        if enable:
            target = broadcaster._broadcast_loop_mixer
        else:
            target = broadcaster._broadcast_loop
        
        broadcaster.broadcast_thread = threading.Thread(target=target)
        broadcaster.broadcast_thread.daemon = True
        broadcaster.broadcast_thread.start()
        
        # Если был трек — очищаем очередь и переотправляем маркер
        if radio_state['current_track']:
            while not audio_queue.empty():
                try:
                    audio_queue.get_nowait()
                except queue.Empty:
                    break
            
            silence_duration_ms = 200
            silence_samples = int(44100 * silence_duration_ms / 1000) * 2 * 2
            silence_chunk = b'\x00\x00' * silence_samples
            audio_queue.put(silence_chunk)
            
            end_marker = b'\xDE\xAD\xBE\xEF'
            audio_queue.put(end_marker)
        
        print(f"🎛️ Режим микширования: {'ВКЛЮЧЕН' if enable else 'ВЫКЛЮЧЕН'}")
        
        return jsonify({'success': True, 'mixer_enabled': enable})
        
    except Exception as e:
        print(f"Ошибка в radio_mixer: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/radio/status')
def radio_status():
    with state_lock:
        with listeners_lock:
            return jsonify({
                'is_live': radio_state['is_live'],
                'current_track': radio_state['current_track'],
                'current_playlist': radio_state['current_playlist'],
                'mic_active': radio_state['mic_active'],
                'listeners': len(active_listeners),
                'queue_size': audio_queue.qsize(),
                'mixer_enabled': radio_state.get('mixer_enabled', False)
            })

@app.route('/api/radio/stop', methods=['POST'])
def radio_stop():
    mp3_player.stop()
    with state_lock:
        radio_state['is_live'] = False
        radio_state['current_track'] = None
        radio_state['current_playlist'] = None
    
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
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .debug-container {
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 30px;
                padding: 30px;
                width: 100%;
                max-width: 600px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            }
            h1 { color: white; font-size: 1.8rem; display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
            .badge { background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; color: #ff6b6b; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; display: inline-block; margin-bottom: 20px; }
            .stream-info { background: rgba(0, 0, 0, 0.3); border-radius: 15px; padding: 15px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1); }
            .url-box { background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 10px; font-family: monospace; font-size: 0.85rem; color: #4ecdc4; word-break: break-all; margin: 10px 0; }
            .status { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; background: rgba(78, 205, 196, 0.1); border: 1px solid #4ecdc4; }
            .live { color: #4ecdc4; font-weight: bold; animation: blink 1s infinite; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            audio { width: 100%; margin: 20px 0; border-radius: 30px; }
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
            .stat-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 15px; text-align: center; }
            .stat-label { font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); margin-bottom: 5px; }
            .stat-value { font-size: 1.8rem; font-weight: bold; color: #4ecdc4; }
            .now-playing { background: rgba(102, 126, 234, 0.1); border-radius: 15px; padding: 15px; margin: 20px 0; border-left: 4px solid #667eea; }
            .now-playing h3 { font-size: 0.9rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px; }
            .now-playing .title { font-size: 1.2rem; font-weight: bold; margin-bottom: 5px; }
            .refresh-btn { width: 100%; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; padding: 12px; border-radius: 30px; cursor: pointer; font-size: 1rem; transition: all 0.3s; }
            .refresh-btn:hover { background: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
            .footer-note { margin-top: 20px; font-size: 0.8rem; color: rgba(255, 255, 255, 0.3); text-align: center; }
            .mic-indicator { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; margin-top: 10px; }
            .mic-on { background: rgba(78, 205, 196, 0.2); border: 1px solid #4ecdc4; color: #4ecdc4; }
            .mic-off { background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; color: #ff6b6b; }
        </style>
    </head>
    <body>
        <div class="debug-container">
            <h1><span>📻</span> Техническая страница радио</h1>
            <div class="badge">🔧 DEBUG MODE</div>
            <div class="stream-info">
                <div style="margin-bottom: 10px;">🎵 Прямой эфир</div>
                <div class="url-box" id="streamUrl"></div>
                <div class="status" id="streamStatus"><span>⏳</span><span>Проверка соединения...</span></div>
            </div>
            <audio id="audioPlayer" controls autoplay><source src="/api/radio/stream" type="audio/L16"></audio>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-label">Слушателей</div><div class="stat-value" id="listeners">0</div></div>
                <div class="stat-card"><div class="stat-label">Буфер</div><div class="stat-value" id="buffer">0</div></div>
            </div>
            <div class="now-playing" id="nowPlaying"><h3>🎵 Сейчас в эфире</h3><div class="title">Загрузка...</div><div class="artist"></div><div id="micStatus"></div></div>
            <button class="refresh-btn" onclick="refreshStats()">🔄 Обновить информацию</button>
            <div class="footer-note">Техническая страница для отладки радио-потока</div>
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
                        nowPlayingDiv.innerHTML = `<h3>🎵 Сейчас в эфире</h3><div class="title">${data.current_track.title || 'Неизвестно'}</div><div class="artist">${data.current_track.artist || 'Неизвестный исполнитель'}</div><div class="mic-indicator ${data.mic_active ? 'mic-on' : 'mic-off'}">${data.mic_active ? '🎤 Микрофон включен' : '🔇 Микрофон выключен'}</div>`;
                    } else {
                        nowPlayingDiv.innerHTML = `<h3>🎵 Сейчас в эфире</h3><div class="title">${data.mic_active ? 'Микрофон активен' : 'Эфир не активен'}</div><div class="artist"></div><div class="mic-indicator ${data.mic_active ? 'mic-on' : 'mic-off'}">${data.mic_active ? '🎤 Микрофон включен' : '🔇 Микрофон выключен'}</div>`;
                    }
                    const statusDiv = document.getElementById('streamStatus');
                    if (data.is_live || data.mic_active) {
                        statusDiv.innerHTML = '<span>🔴</span><span class="live">Поток активен</span>';
                    } else {
                        statusDiv.innerHTML = '<span>⭕</span><span style="color: #ff6b6b;">Поток остановлен</span>';
                    }
                } catch (error) { console.error('Ошибка:', error); }
            }
            window.onload = function() {
                document.getElementById('streamUrl').textContent = window.location.origin + '/api/radio/stream';
                refreshStats();
                setInterval(refreshStats, 2000);
            };
            document.getElementById('audioPlayer').addEventListener('error', function(e) {
                document.getElementById('streamStatus').innerHTML = '<span>❌</span><span style="color: #ff6b6b;">Ошибка подключения</span>';
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial; background: #1a1a2e; color: white; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .status { background: #16213e; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .track-list { background: #0f3460; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .button-group { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
            button { background: #e94560; color: white; border: none; padding: 10px 20px; margin: 5px; cursor: pointer; border-radius: 5px; }
            button:hover { background: #ff6b6b; }
            .mic-btn { background: #f39c12; }
            .mixer-btn { background: #9b59b6; }
            .mixer-btn.active { background: #2ecc71; }
            .stop-btn { background: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎧 DJ Panel</h1>
            <div class="status" id="status">Loading...</div>
            
            <div class="button-group">
                <button id="micBtn" class="mic-btn">🎤 Включить микрофон</button>
                <button id="mixerBtn" class="mixer-btn">🎛️ Режим: РАЗДЕЛЬНЫЙ</button>
                <button id="stopBtn" class="stop-btn">⏹ Остановить эфир</button>
            </div>
            
            <div class="track-list">
                <h2>Available Tracks</h2>
                <div id="tracks"></div>
            </div>
        </div>
        <script>
            let micActive = false;
            let mixerEnabled = false;
            
            async function updateStatus() {
                const res = await fetch('/api/radio/status');
                const data = await res.json();
                document.getElementById('status').innerHTML = `
                    <p>🎵 Трек: ${data.current_track ? data.current_track.title : 'None'}</p>
                    <p>🎤 Микрофон: ${data.mic_active ? 'ON' : 'OFF'}</p>
                    <p>👥 Слушателей: ${data.listeners}</p>
                    <p>🎛️ Режим: ${data.mixer_enabled ? 'МИКШИРОВАНИЕ' : 'РАЗДЕЛЬНЫЙ'}</p>
                `;
                micActive = data.mic_active;
                mixerEnabled = data.mixer_enabled;
                
                const micBtn = document.getElementById('micBtn');
                micBtn.textContent = micActive ? '🔴 Выключить микрофон' : '🎤 Включить микрофон';
                
                const mixerBtn = document.getElementById('mixerBtn');
                mixerBtn.textContent = mixerEnabled ? '🎛️ Режим: МИКШИРОВАНИЕ' : '🎛️ Режим: РАЗДЕЛЬНЫЙ';
                mixerBtn.classList.toggle('active', mixerEnabled);
            }
            
            async function loadTracks() {
                const res = await fetch('/api/tracks');
                const tracks = await res.json();
                document.getElementById('tracks').innerHTML = tracks.map(track => `<button onclick="playTrack(${track.id})">${track.title} - ${track.artist}</button>`).join('');
            }
            
            async function playTrack(id) {
                await fetch(`/api/radio/play/${id}`, {method: 'POST'});
                updateStatus();
            }
            
            async function toggleMic() {
                const action = micActive ? 'off' : 'on';
                await fetch('/api/radio/mic', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({action})
                });
                updateStatus();
            }
            
            async function toggleMixer() {
                const enable = !mixerEnabled;
                await fetch('/api/radio/mixer', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({enable})
                });
                updateStatus();
            }
            
            async function stopRadio() {
                await fetch('/api/radio/stop', {method: 'POST'});
                updateStatus();
            }
            
            document.getElementById('micBtn').addEventListener('click', toggleMic);
            document.getElementById('mixerBtn').addEventListener('click', toggleMixer);
            document.getElementById('stopBtn').addEventListener('click', stopRadio);
            
            loadTracks();
            updateStatus();
            setInterval(updateStatus, 2000);
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
    print("🎛️ Mixer mode: DISABLED by default")
    print("="*50)
    
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)