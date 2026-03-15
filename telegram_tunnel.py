import telebot
import requests
import threading

# НАСТРОЙКИ
TOKEN = '8219111018:AAGSJw2KZ7i9Hw6HwtyEEDbzXuSNlM1z7fU'
CHAT_ID = '@drd_music_player_bot'

bot = telebot.TeleBot(TOKEN)

@bot.message_handler(commands=['start', 'link'])
def send_link(message):
    """Отправляет ссылку на локальный сервер"""
    response = (
        "🎵 *Ваш Music Player*\n\n"
        "*Для устройств в той же Wi-Fi сети:*\n"
        "`http://192.168.0.105:5000`\n\n"
        "*Как открыть с телефона:*\n"
        "1. Убедитесь что телефон подключен к той же Wi-Fi\n"
        "2. Откройте браузер на телефоне\n"
        "3. Введите адрес выше\n\n"
        "*Текущий внешний IP:*\n"
        "`http://ваш-внешний-ip:5000`\n\n"
        "_Для доступа из интернета нужна переадресация портов_"
    )
    bot.reply_to(message, response, parse_mode='Markdown')

@bot.message_handler(commands=['ip'])
def send_ip(message):
    """Показывает текущий внешний IP"""
    try:
        ip = requests.get('https://api.ipify.org', timeout=5).text
        bot.reply_to(message, f"🌐 Ваш внешний IP: `{ip}`", parse_mode='Markdown')
    except:
        bot.reply_to(message, "❌ Не удалось получить IP")

def run_bot():
    print("🤖 Telegram бот запущен...")
    bot.polling()

if __name__ == '__main__':
    # Запуск бота в отдельном потоке
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    
    print("✅ Бот запущен! Отправьте /start в Telegram")
    print("📡 Ваш Flask должен быть запущен отдельно на порту 5000")
    input("Нажмите Enter для выхода...")