<<<<<<< HEAD
import requests
from bs4 import BeautifulSoup
import schedule
import time
from datetime import datetime

# Discord Webhook URL
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1319932098714538006/NE7Q5mQ5mAYRnaZJWlTHHlSdbgfjq1mafQuXxTUS9TpZdhi0y1W23JaXJkCAOG5b1dzG"

# 監視対象のURLと要素の指定
urls_to_watch = [
    {"url": "https://finance.yahoo.co.jp/cm/message/1998407/ffc7pjbf6q3t2a?unread=2343", "selectors": [
        {"type": "id", "value": "page1"}  # メインリストのIDを指定
    ]}
]

# 更新データの保存用
last_data = {}

# Discordに通知を送信
def send_discord_notification(message):
    payload = {"content": message}
    try:
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
        response.raise_for_status()
        print(f"Notification sent: {response.status_code}")
    except Exception as e:
        print(f"Error sending notification to Discord: {e}")

# 特定のURLと複数の要素をスクレイピングして変更を検出
def check_updates():
    global last_data
    changes_detected = False
    updated_info = []

    for target in urls_to_watch:
        url = target["url"]
        selectors = target["selectors"]

        try:
            # HTTPリクエストでページを取得
            response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            for selector in selectors:
                selector_type = selector["type"]
                selector_value = selector["value"]

                if selector_type == "id":
                    parent_element = soup.find(id=selector_value)
                    if parent_element:
                        # コメントリスト内の各コメント要素を取得
                        comment_elements = parent_element.find_all("li")
                        for index, comment in enumerate(comment_elements):
                            # コメントテキストを抽出
                            comment_text = comment.find("p", class_="comText").text.strip() if comment.find("p", class_="comText") else "No Content"
                            comment_id = comment.get("id", "No ID")
                            comment_author = comment.find("p", class_="comWriter a").text.strip() if comment.find("p", class_="comWriter a") else "Unknown Author"

                            # データキー
                            key = f"{url}:{selector_value}:{comment_id}"

                            # 初回保存または更新チェック
                            if key not in last_data:
                                last_data[key] = comment_text

                            if last_data[key] != comment_text:
                                changes_detected = True
                                updated_info.append(f"ID: {comment_id}\nAuthor: {comment_author}\nText: {comment_text}")
                                last_data[key] = comment_text

        except Exception as e:
            updated_info.append(f"Error checking {url}: {e}")

    # 更新があった場合にDiscordに通知
    if changes_detected:
        message = "\n\n".join(updated_info)
        send_discord_notification(f"**Webpage Update Detected!**\n{message}")
        print(message)  # ログに出力

# スケジュールを設定（1分ごとに実行）
def schedule_jobs():
    schedule.every(1).minutes.do(check_updates)

    while True:
        print(f"Running scheduled jobs... {datetime.now()}")
        schedule.run_pending()
        time.sleep(1)

# メイン実行
if __name__ == "__main__":
    print("Monitoring started... (24/7)")
    schedule_jobs()
=======
import requests
from bs4 import BeautifulSoup
import schedule
import time
from datetime import datetime

# Discord Webhook URL
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1319932098714538006/NE7Q5mQ5mAYRnaZJWlTHHlSdbgfjq1mafQuXxTUS9TpZdhi0y1W23JaXJkCAOG5b1dzG"

# 監視対象のURLと要素の指定
urls_to_watch = [
    {"url": "https://finance.yahoo.co.jp/cm/message/1998407/ffc7pjbf6q3t2a?unread=2343", "selectors": [
        {"type": "id", "value": "page1"}  # メインリストのIDを指定
    ]}
]

# 更新データの保存用
last_data = {}

# Discordに通知を送信
def send_discord_notification(message):
    payload = {"content": message}
    try:
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
        response.raise_for_status()
        print(f"Notification sent: {response.status_code}")
    except Exception as e:
        print(f"Error sending notification to Discord: {e}")

# 特定のURLと複数の要素をスクレイピングして変更を検出
def check_updates():
    global last_data
    changes_detected = False
    updated_info = []

    for target in urls_to_watch:
        url = target["url"]
        selectors = target["selectors"]

        try:
            # HTTPリクエストでページを取得
            response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            for selector in selectors:
                selector_type = selector["type"]
                selector_value = selector["value"]

                if selector_type == "id":
                    parent_element = soup.find(id=selector_value)
                    if parent_element:
                        # コメントリスト内の各コメント要素を取得
                        comment_elements = parent_element.find_all("li")
                        for index, comment in enumerate(comment_elements):
                            # コメントテキストを抽出
                            comment_text = comment.find("p", class_="comText").text.strip() if comment.find("p", class_="comText") else "No Content"
                            comment_id = comment.get("id", "No ID")
                            comment_author = comment.find("p", class_="comWriter a").text.strip() if comment.find("p", class_="comWriter a") else "Unknown Author"

                            # データキー
                            key = f"{url}:{selector_value}:{comment_id}"

                            # 初回保存または更新チェック
                            if key not in last_data:
                                last_data[key] = comment_text

                            if last_data[key] != comment_text:
                                changes_detected = True
                                updated_info.append(f"ID: {comment_id}\nAuthor: {comment_author}\nText: {comment_text}")
                                last_data[key] = comment_text

        except Exception as e:
            updated_info.append(f"Error checking {url}: {e}")

    # 更新があった場合にDiscordに通知
    if changes_detected:
        message = "\n\n".join(updated_info)
        send_discord_notification(f"**Webpage Update Detected!**\n{message}")
        print(message)  # ログに出力

# スケジュールを設定（1分ごとに実行）
def schedule_jobs():
    schedule.every(1).minutes.do(check_updates)

    while True:
        print(f"Running scheduled jobs... {datetime.now()}")
        schedule.run_pending()
        time.sleep(1)

# メイン実行
if __name__ == "__main__":
    print("Monitoring started... (24/7)")
    schedule_jobs()
>>>>>>> 3689f12266ae630fe311732deafae34642291526
