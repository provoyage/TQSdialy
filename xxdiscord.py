import asyncio
from twikit import Client
from discord_webhook import DiscordWebhook
from datetime import datetime

# グローバル設定
LIST_ID = "1205628545965285377"  # TwitterリストID
RETWEET_THRESHOLD = 13          # 通知するリツイート数の閾値
CHECK_INTERVAL = 15 * 60        # チェック間隔（秒） (15分)

# Discord Webhook URL
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1318974723581018124/XZDT3DUr2ScPu4-60Em8ZJRGc2C2w8vEr6cGLSJi2wpWwdZK5Z81GAizyBgRLYuGAJgF"  # Webhook URLを入力

# Twikitクライアント
client = Client()

# languageを明示的に設定
if not hasattr(client, "language") or client.language is None:
    client.language = "en-US"  # 言語設定
print(f"Twikit client language: {client.language}")  # デバッグ用

# 非同期ログイン処理
async def login():
    try:
        await client.login(
            auth_info_1="luckyhappinessboy@gmail.com",
            auth_info_2="SiawaseBoy",
            password="adagissimo0510"
        )
        print(f"Logged in successfully as: {client.user}")
    except Exception as e:
        print(f"Login failed: {e}")
        raise e

# Discord通知関数
async def notify_to_discord(username, text, retweets, post_url):
    try:
        message = (
            f"**投稿者**: @{username}\n"
            f"**リツイート数**: {retweets}\n"
            f"**本文**: {text[:100]}...\n"  # 長すぎる場合は切り捨て
            f"**リンク**: {post_url}"
        )
        webhook = DiscordWebhook(url=DISCORD_WEBHOOK_URL, content=message)
        response = webhook.execute()
        print(f"Notification sent for @{username}'s post: {response.status_code}")
    except Exception as e:
        print(f"Error sending Discord notification: {e}")

# リスト投稿のチェック
async def check_list_posts():
    print(f"Checking list posts at {datetime.now()}...")

    try:
        # 最新の100ポストを取得
        posts = await client.get_list_tweets(list_id=LIST_ID, count=100)
        if not posts:
            print("No posts found.")
            return

        # 各ポストをチェック
        for post in posts:
            username = post.user.screen_name
            text = post.text
            retweets = post.retweet_count
            post_url = f"https://twitter.com/{username}/status/{post.id}"

            # リツイート数の条件を確認
            if retweets > RETWEET_THRESHOLD:
                print(f"Notifying post by @{username} with {retweets} retweets.")
                await notify_to_discord(username, text, retweets, post_url)

    except Exception as e:
        print(f"Error while checking posts: {e}")

# メイン処理
async def main():
    await login()  # ログイン
    while True:
        await check_list_posts()  # 投稿をチェック
        await asyncio.sleep(CHECK_INTERVAL)  # 15分待機

# 実行
if __name__ == "__main__":
    asyncio.run(main())
