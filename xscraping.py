import asyncio
from twikit import Client
from plyer import notification
from datetime import datetime, timedelta
import os
import traceback

# グローバル変数
COOKIE_FILE = "twitter_cookies.json"
LIST_ID = "1868951909450854486"  # TwitterリストID
RETWEET_THRESHOLD = 100          # 通知するリツイート数の閾値
CHECK_INTERVAL = 60              # チェック間隔（秒）

# Twikitクライアント
client = Client()

# 言語属性が未定義の場合にデフォルト値を設定
if not hasattr(client, "language") or client.language is None:
    client.language = "en-US"  # 必要に応じて "ja-JP"

# クッキー削除
def clear_cookies():
    if os.path.exists(COOKIE_FILE):
        os.remove(COOKIE_FILE)
        print("Cookies cleared.")
    else:
        print("No cookies to clear.")

# クッキー保存
def save_cookies():
    try:
        client.save_cookies(COOKIE_FILE)
        print("Cookies saved successfully.")
    except Exception as e:
        print(f"Error saving cookies: {e}")

# クッキー読み込み
def load_cookies():
    if not os.path.exists(COOKIE_FILE):
        print(f"No cookies file found: {COOKIE_FILE}. Proceeding with new login.")
        return False
    try:
        client.load_cookies(COOKIE_FILE)
        print("Cookies loaded successfully.")
        return True
    except Exception as e:
        print(f"Error loading cookies: {e}")
        return False

# 非同期ログイン処理
async def login():
    if not load_cookies():
        try:
            await client.login(
                auth_info_1="odftjj@gmail.com",
                auth_info_2="Qodftjj",
                password="adagissimo0510"
            )
            print(f"Logged in successfully as: {client.user}")
            save_cookies()
        except Exception as e:
            print(f"Login failed: {e}")

# リスト投稿の監視
async def monitor_list_posts(monitored_posts):
    print("Fetching new posts from the list...")
    now = datetime.now()

    try:
        posts = await client.get_list_tweets(list_id=LIST_ID, count=20)
        if posts is None:
            print("Error: get_list_tweets returned None.")
            return

        for post in posts:
            post_id = post["id"]
            post_time = datetime.fromisoformat(post["created_at"].replace("Z", "+00:00"))
            retweets = post["retweet_count"]

            if post_id not in monitored_posts and now - post_time <= timedelta(minutes=10):
                monitored_posts[post_id] = {
                    "user": post["user"]["screen_name"],
                    "text": post["text"],
                    "retweets": retweets
                }
                print(f"Monitoring post by @{post['user']['screen_name']} (ID: {post_id})")
    except Exception as e:
        print(f"Error fetching posts from the list: {e}")
        traceback.print_exc()

# メイン処理
async def main():
    clear_cookies()  # 古いセッションをクリア
    await login()
    monitored_posts = {}

    try:
        while True:
            await monitor_list_posts(monitored_posts)
            await asyncio.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        print("Monitoring stopped.")

if __name__ == "__main__":
    asyncio.run(main())
