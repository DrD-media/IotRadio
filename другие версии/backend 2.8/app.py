from flask import Flask, send_file, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import glob
import json
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Разрешаем запросы из React

# Пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_BUILD_DIR = os.path.join(BASE_DIR, '../frontend/dist')

# Папка с музыкой
MUSIC_FOLDER = 'music_files'
# Папка с обложками
COVERS_FOLDER = 'covers'
# Файл базы данных JSON
DB_FILE = 'music_data.json'

TEXTS_FOLDER = 'track_texts'
os.makedirs(TEXTS_FOLDER, exist_ok=True)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Отдает статические файлы React приложения"""
    # Проверяем существование папки сборки
    if not os.path.exists(FRONTEND_BUILD_DIR):
        return jsonify({
            "error": "Frontend not built",
            "message": "Please build React app first: npm run build",
            "api_endpoints": {
                "tracks": "/api/tracks",
                "info": "/api/info"
            }
        }), 503
    
    # Если путь существует в папке сборки - отдаем файл
    if path and os.path.exists(os.path.join(FRONTEND_BUILD_DIR, path)):
        return send_from_directory(FRONTEND_BUILD_DIR, path)
    
    # Иначе отдаем index.html
    return send_from_directory(FRONTEND_BUILD_DIR, 'index.html')

def load_tracks_data():
    """Загружает данные о треках из JSON файла"""
    if not os.path.exists(DB_FILE):
        return {"tracks": [], "next_id": 1, "last_updated": ""}
    
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # Убедимся, что есть все необходимые поля
            if "next_id" not in data:
                # Определяем next_id на основе максимального ID
                max_id = max((track.get("id", 0) for track in data.get("tracks", [])), default=0)
                data["next_id"] = max_id + 1
                
            return data
    except Exception as e:
        print(f"Error loading tracks data: {e}")
        return {"tracks": [], "next_id": 1, "last_updated": ""}

def save_tracks_data(data):
    """Сохраняет данные о треках в JSON файл с новой структурой"""
    try:
        data["last_updated"] = datetime.now().isoformat()
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving tracks data: {e}")
        return False
    
def get_track_by_filename(filename):
    """Находит трек по имени файла в новой структуре"""
    tracks_data = load_tracks_data()
    for track in tracks_data.get("tracks", []):
        if track.get("filename") == filename:
            return track
    return None

def natural_sort_key(filename):
    """
    Натуральная сортировка для имен файлов с числами.
    Пример: track_2.mp3, track_10.mp3, track_100.mp3
    """
    # Извлекаем имя без расширения
    name_without_ext = os.path.splitext(filename)[0]
    
    # Разбиваем на текст и числа
    def convert(text):
        return int(text) if text.isdigit() else text.lower()
    
    return [convert(c) for c in re.split(r'(\d+)', name_without_ext)]

def get_tracks_from_folder():
    """Автоматически получает список треков из папки music_files"""
    tracks = []
    
    # Загружаем сохраненные данные
    tracks_data = load_tracks_data()
    saved_tracks = tracks_data.get("tracks", [])
    
    # Создаем словарь для быстрого поиска по имени файла
    saved_tracks_dict = {track["filename"]: track for track in saved_tracks if "filename" in track}
    
    # Ищем все аудиофайлы
    audio_extensions = ['*.mp3', '*.wav', '*.ogg', '*.flac', '*.m4a', '*.aac']
    all_audio_files = []
    
    for ext in audio_extensions:
        all_audio_files.extend(glob.glob(os.path.join(BASE_DIR, MUSIC_FOLDER, ext)))
    
    # Натуральная сортировка
    all_audio_files.sort(key=lambda x: natural_sort_key(os.path.basename(x)))
    
    for i, filepath in enumerate(all_audio_files, 1):
        filename = os.path.basename(filepath)
        
        # Ищем сохраненные данные
        saved_data = saved_tracks_dict.get(filename)
        
        if saved_data:
            # Используем сохраненные данные (ВАЖНО: включаем все поля!)
            track = {
                "id": saved_data.get("id", i),
                "title": saved_data.get("title", ""),
                "artist": saved_data.get("artist", "Неизвестный исполнитель"),
                "description": saved_data.get("description", ""),  # ДОБАВЛЕНО
                "file": filename,
                "filename": filename,
                "cover": saved_data.get("cover", ""),
                "created_date": saved_data.get("created_date", ""),
                "uploaded_by": saved_data.get("uploaded_by", 1),
                "is_public": saved_data.get("is_public", "yes"),
                "track_texts": saved_data.get("track_texts", []),  # ДОБАВЛЕНО
                "liked": False
            }
        else:
            # Генерируем данные по умолчанию
            track_name = os.path.splitext(filename)[0]
            track_name = track_name.replace('_', ' ').replace('-', ' ').title()
            
            track = {
                "id": i,
                "title": track_name,
                "artist": "Неизвестный исполнитель",
                "description": "",  # ДОБАВЛЕНО
                "file": filename,
                "filename": filename,
                "cover": "",
                "created_date": datetime.now().strftime("%Y-%m-%d"),
                "uploaded_by": 1,
                "is_public": "yes",
                "track_texts": [],  # ДОБАВЛЕНО
                "liked": False
            }
        
        tracks.append(track)
    
    return tracks

@app.route('/api/track-text/<int:track_id>/<int:text_id>')
def get_track_text(track_id, text_id):
    """Получить текст трека"""
    try:
        # Загружаем данные треков
        tracks_data = load_tracks_data()
        
        # Ищем трек
        track = None
        for t in tracks_data.get('tracks', []):
            if t.get('id') == track_id:
                track = t
                break
        
        if not track or 'track_texts' not in track:
            return jsonify({"error": "Track or texts not found"}), 404
        
        # Ищем текст
        text_data = None
        for text in track['track_texts']:
            if text.get('id') == text_id:
                text_data = text
                break
        
        if not text_data:
            return jsonify({"error": "Text not found"}), 404
        
        # Пробуем загрузить файл
        filepath = os.path.join(BASE_DIR, TEXTS_FOLDER, text_data['filename'])
        if not os.path.exists(filepath):
            return jsonify({
                "id": text_id,
                "title": text_data.get('title', ''),
                "content": "Файл с текстом не найден"
            })
        
        # Читаем файл
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(filepath, 'r', encoding='cp1251') as f:
                content = f.read()
        
        return jsonify({
            "id": text_id,
            "title": text_data.get('title', ''),
            "language": text_data.get('language', ''),
            "content": content
        })
        
    except Exception as e:
        print(f"Error loading track text: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tracks')
def get_tracks():
    """Получить список всех треков"""
    tracks = get_tracks_from_folder()
    return jsonify(tracks)

@app.route('/api/track/<int:track_id>')
def get_track(track_id):
    """Получить информацию о конкретном треке"""
    tracks = get_tracks_from_folder()
    track = next((t for t in tracks if t['id'] == track_id), None)
    if track:
        return jsonify(track)
    return jsonify({"error": "Track not found"}), 404

@app.route('/api/play/<filename>')
def play_track(filename):
    """Воспроизвести трек (отдать файл)"""
    try:
        # Проверяем безопасность имени файла
        if '..' in filename or filename.startswith('/'):
            return "Invalid filename", 400
        
        filepath = os.path.join(BASE_DIR, MUSIC_FOLDER, filename)
        if not os.path.exists(filepath):
            return "File not found", 404
            
        # Определяем MIME тип по расширению
        ext = os.path.splitext(filename)[1].lower()
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac'
        }
        mimetype = mime_types.get(ext, 'audio/mpeg')
        
        return send_file(filepath, mimetype=mimetype)
    except Exception as e:
        return str(e), 500

@app.route('/api/cover/<filename>')
def get_cover(filename):
    """Получить обложку трека"""
    try:
        # Проверяем безопасность имени файла
        if '..' in filename or filename.startswith('/'):
            return "Invalid filename", 400
        
        filepath = os.path.join(BASE_DIR, COVERS_FOLDER, filename)
        if not os.path.exists(filepath):
            return "Cover not found", 404
            
        # Определяем MIME тип по расширению
        ext = os.path.splitext(filename)[1].lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        }
        mimetype = mime_types.get(ext, 'image/jpeg')
        
        return send_file(filepath, mimetype=mimetype)
    except Exception as e:
        return str(e), 500

@app.route('/api/upload', methods=['POST'])
def upload_track():
    """Загрузить новый трек (позже добавим)"""
    return jsonify({"message": "Upload endpoint"})

@app.route('/api/track-data', methods=['POST'])
def update_track_data():
    """Обновить данные о треке (для админ-панели) - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
    try:
        data = request.json
        filename = data.get('filename')
        track_data = data.get('track_data')
        
        if not filename or not track_data:
            return jsonify({"error": "Missing filename or track_data"}), 400
        
        # Загружаем текущие данные
        tracks_data = load_tracks_data()
        
        # Ищем трек по filename и обновляем его
        updated = False
        for i, track in enumerate(tracks_data.get("tracks", [])):
            if track.get("filename") == filename:
                # Сохраняем ID и filename (они не должны меняться)
                track_data["id"] = track.get("id", len(tracks_data["tracks"]) + 1)
                track_data["filename"] = filename
                
                # Обновляем трек
                tracks_data["tracks"][i] = track_data
                updated = True
                break
        
        # Если трек не найден, добавляем новый
        if not updated:
            # Генерируем новый ID
            track_data["id"] = tracks_data.get("next_id", len(tracks_data.get("tracks", [])) + 1)
            track_data["filename"] = filename
            
            if "tracks" not in tracks_data:
                tracks_data["tracks"] = []
            
            tracks_data["tracks"].append(track_data)
            tracks_data["next_id"] = track_data["id"] + 1
        
        # Сохраняем
        if save_tracks_data(tracks_data):
            return jsonify({
                "success": True, 
                "message": "Track data updated",
                "track": track_data
            })
        else:
            return jsonify({"error": "Failed to save data"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/info')
def get_info():
    """Получить информацию о сервере"""
    tracks = get_tracks_from_folder()
    tracks_data = load_tracks_data()
    
    return jsonify({
        "tracks_count": len(tracks),
        "tracks_in_db": len(tracks_data),
        "supported_formats": ["MP3", "WAV", "OGG", "FLAC", "M4A", "AAC"],
        "music_folder": MUSIC_FOLDER,
        "covers_folder": COVERS_FOLDER,
        "db_file": DB_FILE,
        "status": "running",
        "frontend_built": os.path.exists(FRONTEND_BUILD_DIR)
    })

if __name__ == '__main__':
    # Создаём папку для музыки, если её нет
    music_folder_path = os.path.join(BASE_DIR, MUSIC_FOLDER)
    os.makedirs(music_folder_path, exist_ok=True)
    
    # Создаём папку для обложек, если её нет
    covers_folder_path = os.path.join(BASE_DIR, COVERS_FOLDER)
    os.makedirs(covers_folder_path, exist_ok=True)
    
    # Создаём файл базы данных, если его нет
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)
    
    # Проверяем существование сборки фронтенда
    if not os.path.exists(FRONTEND_BUILD_DIR):
        print(f"⚠️ Внимание: папка сборки фронтенда не найдена: {FRONTEND_BUILD_DIR}")
        print("Запустите сначала: cd frontend && npm run build")
        print("Пока фронтенд не будет доступен, только API.")
    
    # Запускаем сервер
    print("🚀 Сервер запущен на http://0.0.0.0:5000")
    print("📡 API доступно по: http://localhost:5000/api/tracks")
    if os.path.exists(FRONTEND_BUILD_DIR):
        print("🌐 Фронтенд доступен по: http://localhost:5000/")
    app.run(host='0.0.0.0', port=5000, debug=False)