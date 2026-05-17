from flask import Flask, send_file, jsonify, request, Response, render_template
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
        # ⭐ НОВЫЕ ПАРАМЕТРЫ ДЛЯ ДИНАМИЧЕСКОГО УСИЛЕНИЯ
        self.dynamic_gain = 1.0          # текущий коэффициент усиления
        self.target_peak = 800           # целевой пик (можно менять 600-1000)
        self.smoothing = 0.95            # сглаживание (0.9-0.99)
        
    def _apply_dynamic_gain(self, chunk):
        """Динамическая регулировка усиления (не нормализация каждого чанка)"""
        if not chunk or len(chunk) == 0:
            return chunk
        
        # Находим максимальный сэмпл в этом чанке
        max_sample = 0
        for i in range(0, len(chunk), 2):
            sample = int.from_bytes(chunk[i:i+2], 'little', signed=True)
            if abs(sample) > max_sample:
                max_sample = abs(sample)
        
        # Динамически подстраиваем усиление
        if max_sample > self.target_peak:
            # Сигнал слишком громкий — быстро уменьшаем усиление
            correction = self.target_peak / max_sample
            self.dynamic_gain = self.dynamic_gain * correction * 0.5 + self.dynamic_gain * 0.5
        elif max_sample < self.target_peak * 0.5 and max_sample > 10:
            # Сигнал слишком тихий — медленно увеличиваем усиление
            correction = self.target_peak / max_sample
            self.dynamic_gain = self.dynamic_gain * correction * 0.1 + self.dynamic_gain * 0.9
        
        # Ограничиваем коэффициент (не выше 3.0, не ниже 0.3)
        self.dynamic_gain = max(0.3, min(3.0, self.dynamic_gain))
        
        # Применяем усиление
        if abs(self.dynamic_gain - 1.0) > 0.05:
            amplified = bytearray()
            for i in range(0, len(chunk), 2):
                sample = int.from_bytes(chunk[i:i+2], 'little', signed=True)
                sample = int(sample * self.dynamic_gain)
                sample = max(-32767, min(32767, sample))
                amplified.extend(sample.to_bytes(2, 'little', signed=True))
            return bytes(amplified)
        
        return chunk
    
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
            chunk = self.chunk_queue.get_nowait()
            # Применяем динамическое усиление
            chunk = self._apply_dynamic_gain(chunk)
            
            # ⭐ Отладочный вывод уровня сигнала и усиления
            if chunk and len(chunk) > 0:
                max_sample = 0
                for i in range(0, len(chunk), 2):
                    sample = int.from_bytes(chunk[i:i+2], 'little', signed=True)
                    if abs(sample) > max_sample:
                        max_sample = abs(sample)
                print(f"🎤 Уровень: {max_sample} | Gain: {self.dynamic_gain:.2f}")
            
            return chunk
        except queue.Empty:
            return None
    
    def stop_capture(self):
        with self.lock:
            self.is_capturing = False
            print("Останавливаем микрофон...")
            
            # Сбрасываем усиление при остановке
            self.dynamic_gain = 1.0
            
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
    def __init__(self, music_gain=0.6, mic_gain=1.0):
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
                        # Конвертируем моно в стерео (без дополнительной нормализации)
                        stereo_chunk = bytearray()
                        for i in range(0, len(mic_chunk), 2):
                            sample = mic_chunk[i:i+2]
                            stereo_chunk.extend(sample)
                            stereo_chunk.extend(sample)
                        chunk_to_send = bytes(stereo_chunk)
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
        mixer = AudioMixer(music_gain=0.6, mic_gain=1.0)
        
        while self.is_broadcasting:
            try:
                music_chunk = None
                mic_chunk = None
                
                # Получаем музыку, если трек выбран
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
    
    # Отправляем тишину и маркер для сброса ESP32
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
        time.sleep(0.2)
        
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
# API ДЛЯ УПРАВЛЕНИЯ ТРЕКАМИ
# ============================================

# Разрешенные расширения
ALLOWED_AUDIO = {'mp3', 'wav', 'ogg', 'm4a'}
ALLOWED_IMAGES = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
ALLOWED_TEXTS = {'txt'}

def allowed_file(filename, allowed_set):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_set

# ============================================
# API ДЛЯ УПРАВЛЕНИЯ ТРЕКАМИ (CRUD)
# ============================================

@app.route('/api/tracks/<int:track_id>', methods=['PUT'])
def update_track(track_id):
    """Обновление информации о треке"""
    try:
        data = request.json
        
        # Загружаем текущие данные
        tracks_data = load_tracks_data()
        tracks = tracks_data.get('tracks', [])
        
        # Находим трек
        track_index = None
        for i, t in enumerate(tracks):
            if t['id'] == track_id:
                track_index = i
                break
        
        if track_index is None:
            return jsonify({'error': 'Track not found'}), 404
        
        # Обновляем поля
        for key, value in data.items():
            if key != 'id':
                tracks[track_index][key] = value
        
        # Сохраняем
        with open('music_data.json', 'w', encoding='utf-8') as f:
            json.dump(tracks_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'track': tracks[track_index]})
        
    except Exception as e:
        print(f"Ошибка обновления трека: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks/<int:track_id>', methods=['DELETE'])
def delete_track(track_id):
    """Удаление трека"""
    try:
        tracks_data = load_tracks_data()
        tracks = tracks_data.get('tracks', [])
        
        # Находим и удаляем трек
        track_to_delete = None
        for t in tracks:
            if t['id'] == track_id:
                track_to_delete = t
                break
        
        if track_to_delete is None:
            return jsonify({'error': 'Track not found'}), 404
        
        # Удаляем файлы
        # MP3 файл
        mp3_path = os.path.join(BASE_DIR, 'music_files', track_to_delete.get('filename', ''))
        if os.path.exists(mp3_path):
            os.remove(mp3_path)
        
        # Обложка
        cover_path = os.path.join(BASE_DIR, 'covers', track_to_delete.get('cover', ''))
        if os.path.exists(cover_path) and track_to_delete.get('cover'):
            os.remove(cover_path)
        
        # Тексты
        for text in track_to_delete.get('track_texts', []):
            text_path = os.path.join(BASE_DIR, 'track_texts', text.get('filename', ''))
            if os.path.exists(text_path):
                os.remove(text_path)
        
        # Удаляем из списка
        tracks = [t for t in tracks if t['id'] != track_id]
        tracks_data['tracks'] = tracks
        
        with open('music_data.json', 'w', encoding='utf-8') as f:
            json.dump(tracks_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Ошибка удаления трека: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tracks', methods=['POST'])
def create_track():
    """Создание нового трека (только метаданные, без файла)"""
    try:
        data = request.json
        
        tracks_data = load_tracks_data()
        tracks = tracks_data.get('tracks', [])
        
        # Генерируем новый ID
        new_id = max([t['id'] for t in tracks]) + 1 if tracks else 1
        
        new_track = {
            'id': new_id,
            'filename': data.get('filename', f'track_{new_id}.mp3'),
            'title': data.get('title', 'Новый трек'),
            'artist': data.get('artist', 'Неизвестный исполнитель'),
            'description': data.get('description', ''),
            'cover': data.get('cover', ''),
            'created_date': data.get('created_date', datetime.now().strftime('%Y-%m-%d')),
            'uploaded_by': data.get('uploaded_by', 1),
            'is_public': data.get('is_public', 'yes'),
            'track_texts': data.get('track_texts', [])
        }
        
        tracks.append(new_track)
        
        with open('music_data.json', 'w', encoding='utf-8') as f:
            json.dump(tracks_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'track': new_track})
        
    except Exception as e:
        print(f"Ошибка создания трека: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload/mp3', methods=['POST'])
def upload_mp3():
    """Загрузка MP3 файла"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not allowed_file(file.filename, ALLOWED_AUDIO):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Генерируем уникальное имя
        ext = file.filename.rsplit('.', 1)[1].lower()
        new_filename = f"track_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
        
        # Сохраняем
        filepath = os.path.join(BASE_DIR, 'music_files', new_filename)
        file.save(filepath)
        
        return jsonify({'success': True, 'filename': new_filename})
        
    except Exception as e:
        print(f"Ошибка загрузки MP3: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload/cover', methods=['POST'])
def upload_cover():
    """Загрузка обложки"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not allowed_file(file.filename, ALLOWED_IMAGES):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Генерируем уникальное имя
        ext = file.filename.rsplit('.', 1)[1].lower()
        new_filename = f"cover_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
        
        # Сохраняем
        filepath = os.path.join(BASE_DIR, 'covers', new_filename)
        file.save(filepath)
        
        return jsonify({'success': True, 'filename': new_filename})
        
    except Exception as e:
        print(f"Ошибка загрузки обложки: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload/text', methods=['POST'])
def upload_text():
    """Загрузка текста песни (.txt)"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not allowed_file(file.filename, ALLOWED_TEXTS):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Генерируем уникальное имя
        ext = file.filename.rsplit('.', 1)[1].lower()
        new_filename = f"text_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
        
        # Сохраняем
        filepath = os.path.join(BASE_DIR, 'track_texts', new_filename)
        file.save(filepath)
        
        return jsonify({'success': True, 'filename': new_filename})
        
    except Exception as e:
        print(f"Ошибка загрузки текста: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================
# API ДЛЯ УПРАВЛЕНИЯ ПЛЕЙЛИСТАМИ
# ============================================

@app.route('/api/playlists/<int:playlist_id>', methods=['PUT'])
def update_playlist(playlist_id):
    """Обновление информации о плейлисте"""
    try:
        data = request.json
        
        playlists_data = load_playlists()
        playlists = playlists_data.get('playlists', [])
        
        playlist_index = None
        for i, p in enumerate(playlists):
            if p['id'] == playlist_id:
                playlist_index = i
                break
        
        if playlist_index is None:
            return jsonify({'error': 'Playlist not found'}), 404
        
        # Обновляем поля
        for key, value in data.items():
            if key != 'id':
                playlists[playlist_index][key] = value
        
        with open('playlists.json', 'w', encoding='utf-8') as f:
            json.dump(playlists_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'playlist': playlists[playlist_index]})
        
    except Exception as e:
        print(f"Ошибка обновления плейлиста: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/playlists/<int:playlist_id>', methods=['DELETE'])
def delete_playlist(playlist_id):
    """Удаление плейлиста"""
    try:
        playlists_data = load_playlists()
        playlists = playlists_data.get('playlists', [])
        
        playlists = [p for p in playlists if p['id'] != playlist_id]
        playlists_data['playlists'] = playlists
        
        with open('playlists.json', 'w', encoding='utf-8') as f:
            json.dump(playlists_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Ошибка удаления плейлиста: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/playlists', methods=['POST'])
def create_playlist():
    """Создание нового плейлиста"""
    try:
        data = request.json
        
        playlists_data = load_playlists()
        playlists = playlists_data.get('playlists', [])
        
        new_id = max([p['id'] for p in playlists]) + 1 if playlists else 1
        
        new_playlist = {
            'id': new_id,
            'name': data.get('name', 'Новый плейлист'),
            'type': data.get('type', 'user'),
            'owner_id': data.get('owner_id', 1),
            'cover': data.get('cover', ''),
            'created_date': data.get('created_date', datetime.now().strftime('%Y-%m-%d')),
            'last_updated': datetime.now().strftime('%Y-%m-%d'),
            'track_ids': data.get('track_ids', []),
            'description': data.get('description', ''),
            'is_public': data.get('is_public', 'yes')
        }
        
        playlists.append(new_playlist)
        
        with open('playlists.json', 'w', encoding='utf-8') as f:
            json.dump(playlists_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'playlist': new_playlist})
        
    except Exception as e:
        print(f"Ошибка создания плейлиста: {e}")
        return jsonify({'error': str(e)}), 500
    
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
    return render_template('debug_radio.html')

@app.route('/dj')
def dj_panel():
    return render_template('dj_panel.html')

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