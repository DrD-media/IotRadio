import subprocess
import threading
import queue
import tempfile
import os

class MP3toPCMConverter:
    """Конвертирует MP3 в PCM на лету"""
    
    def __init__(self):
        self.process = None
        self.output_queue = queue.Queue(maxsize=100)
        self.is_converting = False
        
    def convert_file(self, mp3_filepath):
        """Запускает конвертацию MP3 файла в PCM поток"""
        self.is_converting = True
        
        # Используем ffmpeg для конвертации
        cmd = [
            'ffmpeg',
            '-i', mp3_filepath,           # входной MP3
            '-f', 's16le',                # выходной формат: PCM 16-bit little-endian
            '-acodec', 'pcm_s16le',       # PCM кодек
            '-ar', '44100',               # частота 44.1kHz
            '-ac', '2',                   # стерео
            '-'
        ]
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                bufsize=4096
            )
            
            # Читаем PCM данные и отправляем в очередь
            while self.is_converting:
                chunk = self.process.stdout.read(4096)
                if not chunk:
                    break
                self.output_queue.put(chunk)
                
        except Exception as e:
            print(f"Ошибка конвертации: {e}")
        finally:
            self.is_converting = False
    
    def get_chunk(self, timeout=0.1):
        """Получает следующий PCM чанк"""
        try:
            return self.output_queue.get(timeout=timeout)
        except queue.Empty:
            return None
    
    def stop(self):
        """Останавливает конвертацию"""
        self.is_converting = False
        if self.process:
            self.process.terminate()
            self.process = None