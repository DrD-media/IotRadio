import os
import time
import struct
import math
from flask import Flask, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Глобальные переменные
current_track = None
mic_active = False
listeners = 0

def generate_test_tone():
    """Генерирует тестовый сигнал (синусоида 440Hz)"""
    sample_rate = 44100
    frequency = 440
    amplitude = 0.5
    
    while True:
        samples = []
        for i in range(1024):
            t = i / sample_rate
            # Синусоида
            value = amplitude * math.sin(2 * math.pi * frequency * t)
            # Конвертируем в 16-bit PCM
            packed = struct.pack('<h', int(value * 32767))
            samples.append(packed)
        
        yield b''.join(samples)
        time.sleep(1024 / sample_rate)  # Ждем пока данные "сыграются"

def generate_mp3_stream():
    """Заглушка для MP3 потока (пока тестовый тон)"""
    return generate_test_tone()

@app.route('/api/radio/stream')
def radio_stream():
    """Аудиопоток для слушателей"""
    global listeners
    
    def generate():
        global listeners
        listeners += 1
        print(f"👂 Слушатель подключился. Всего: {listeners}")
        
        for chunk in generate_test_tone():
            yield chunk
    
    return Response(
        generate(),
        mimetype='audio/L16',  # PCM raw audio
        headers={
            'Cache-Control': 'no-cache',
            'Content-Type': 'audio/L16',
            'Connection': 'keep-alive'
        }
    )

@app.route('/api/radio/status')
def radio_status():
    """Статус радио"""
    return jsonify({
        'is_live': True,
        'current_track': {'id': 1, 'title': 'Тестовый сигнал', 'artist': 'Radio'},
        'mic_active': mic_active,
        'listeners': listeners,
        'queue_size': 0
    })

@app.route('/api/radio/mic', methods=['POST'])
def radio_mic():
    """Управление микрофоном (заглушка)"""
    global mic_active
    data = request.json
    mic_active = (data.get('action') == 'on')
    print(f"🎤 Микрофон: {'включен' if mic_active else 'выключен'}")
    return jsonify({'success': True, 'mic_active': mic_active})

if __name__ == '__main__':
    print("="*50)
    print("🎧 ТЕСТОВОЕ РАДИО")
    print("="*50)
    print("📻 Поток: http://localhost:5000/api/radio/stream")
    print("📊 Статус: http://localhost:5000/api/radio/status")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)