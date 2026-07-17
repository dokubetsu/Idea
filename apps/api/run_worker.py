import asyncio
import logging
import sys
import os

# Add the apps/api folder to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Now import settings and worker
from app.config import settings
from app.shared.events import process_pending_notifications
from app.domains.notifications.subscriber import init_subscriber

# Ensure logging is configured
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("outbox_worker")

async def main():
    log.info("Starting standalone outbox worker process")
    init_subscriber()
    while True:
        try:
            await process_pending_notifications()
        except Exception as e:
            log.error("Error in outbox processing: %s", e)
        await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Outbox worker stopped by user")
