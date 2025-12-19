<<<<<<< HEAD
import asyncio
from twikit import Client
from plyer import notification
from datetime import datetime, timedelta, timezone
import traceback

# グローバル変数
LIST_ID = "1868951909450854486"  # TwitterリストID
RETWEET_THRESHOLD = 2           # 通知するリツイート数の閾値
CHECK_INTERVAL = 60             # チェック間隔（秒）
POST_TIME_THRESHOLD = 10        # 投稿時間の閾値（分）

# Twikitクライアント
client = Client()
if not hasattr(client, "language") or client.language is None:
    client.language = "en-US"  # 言語設定

# 非同期ログイン処理
async def login():
    try:
        await client.login(
            auth_info_1="odftjj@gmail.com",
            auth_info_2="Qodftjj",
            password="adagissimo0510"
        )
        print(f"Logged in successfully as: {client.user}")
    except Exception as e:
        print(f"Login failed: {e}")
        print("Retrying login in 30 minutes...")
        await asyncio.sleep(1800)  # 30分待機

# 通知送信
async def notify_post(username, text, retweets):
    notification.notify(
        title=f"Post by @{username} reached {retweets} retweets!",
        message=text[:100],  # 長すぎるテキストをカット
        timeout=10
    )
    print(f"Notification sent for @{username}'s post.")

# リスト投稿の監視
async def monitor_list_posts(monitored_posts):
    print("Fetching new posts from the list...")
    now = datetime.now(timezone.utc)  # 現在時刻をUTCで取得

    try:
        posts = await client.get_list_tweets(list_id=LIST_ID, count=20)
        if posts is None:
            print("Error: get_list_tweets returned None.")
            return

        for post in posts:
            post_id = post.id
            # Twitterの投稿時間をUTCとして解析
            try:
                post_time = datetime.strptime(post.created_at, "%a %b %d %H:%M:%S %z %Y")
            except ValueError as ve:
                print(f"Error parsing post time: {post.created_at}. Error: {ve}")
                continue

            retweets = post.retweet_count
            username = post.user.screen_name
            text = post.text

            # 現在時刻から10分以上前の投稿をスキップ
            time_diff = (now - post_time).total_seconds()
            if time_diff > POST_TIME_THRESHOLD * 60:
                print(f"Skipping post by @{username} (ID: {post_id}) - older than {POST_TIME_THRESHOLD} minutes. ({time_diff / 60:.2f} minutes old)")
                continue

            # 新しい投稿を記録
            if post_id not in monitored_posts:
                monitored_posts[post_id] = {
                    "user": username,
                    "text": text,
                    "retweets": retweets,
                    "notified": False  # 通知済みフラグを追加
                }
                print(f"New post detected: @{username} (ID: {post_id})")

            # 通知条件の確認: 通知済みでない + 閾値を超えた
            if (not monitored_posts[post_id]["notified"]
                    and retweets >= RETWEET_THRESHOLD):
                monitored_posts[post_id]["retweets"] = retweets
                monitored_posts[post_id]["notified"] = True  # 通知済みに設定
                await notify_post(username, text, retweets)

    except Exception as e:
        print(f"Error fetching posts from the list: {e}")
        traceback.print_exc()

# メイン処理
async def main():
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
=======
import asyncio
from twikit import Client
from plyer import notification
from datetime import datetime, timedelta, timezone
import traceback

# グローバル変数
LIST_ID = "1868951909450854486"  # TwitterリストID
RETWEET_THRESHOLD = 2           # 通知するリツイート数の閾値
CHECK_INTERVAL = 60             # チェック間隔（秒）
POST_TIME_THRESHOLD = 10        # 投稿時間の閾値（分）

# Twikitクライアント
client = Client()
if not hasattr(client, "language") or client.language is None:
    client.language = "en-US"  # 言語設定

# 非同期ログイン処理
async def login():
    try:
        await client.login(
            auth_info_1="odftjj@gmail.com",
            auth_info_2="Qodftjj",
            password="adagissimo0510"
        )
        print(f"Logged in successfully as: {client.user}")
    except Exception as e:
        print(f"Login failed: {e}")
        print("Retrying login in 30 minutes...")
        await asyncio.sleep(1800)  # 30分待機

# 通知送信
async def notify_post(username, text, retweets):
    notification.notify(
        title=f"Post by @{username} reached {retweets} retweets!",
        message=text[:100],  # 長すぎるテキストをカット
        timeout=10
    )
    print(f"Notification sent for @{username}'s post.")

# リスト投稿の監視
async def monitor_list_posts(monitored_posts):
    print("Fetching new posts from the list...")
    now = datetime.now(timezone.utc)  # 現在時刻をUTCで取得

    try:
        posts = await client.get_list_tweets(list_id=LIST_ID, count=20)
        if posts is None:
            print("Error: get_list_tweets returned None.")
            return

        for post in posts:
            post_id = post.id
            # Twitterの投稿時間をUTCとして解析
            try:
                post_time = datetime.strptime(post.created_at, "%a %b %d %H:%M:%S %z %Y")
            except ValueError as ve:
                print(f"Error parsing post time: {post.created_at}. Error: {ve}")
                continue

            retweets = post.retweet_count
            username = post.user.screen_name
            text = post.text

            # 現在時刻から10分以上前の投稿をスキップ
            time_diff = (now - post_time).total_seconds()
            if time_diff > POST_TIME_THRESHOLD * 60:
                print(f"Skipping post by @{username} (ID: {post_id}) - older than {POST_TIME_THRESHOLD} minutes. ({time_diff / 60:.2f} minutes old)")
                continue

            # 新しい投稿を記録
            if post_id not in monitored_posts:
                monitored_posts[post_id] = {
                    "user": username,
                    "text": text,
                    "retweets": retweets,
                    "notified": False  # 通知済みフラグを追加
                }
                print(f"New post detected: @{username} (ID: {post_id})")

            # 通知条件の確認: 通知済みでない + 閾値を超えた
            if (not monitored_posts[post_id]["notified"]
                    and retweets >= RETWEET_THRESHOLD):
                monitored_posts[post_id]["retweets"] = retweets
                monitored_posts[post_id]["notified"] = True  # 通知済みに設定
                await notify_post(username, text, retweets)

    except Exception as e:
        print(f"Error fetching posts from the list: {e}")
        traceback.print_exc()

# メイン処理
async def main():
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
>>>>>>> 3689f12266ae630fe311732deafae34642291526
