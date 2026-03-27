from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
import yt_dlp
import uuid
import os
import glob
import time
import threading

app = FastAPI()
API_TOKEN = os.environ.get("API_TOKEN", "changeme")
DOWNLOAD_DIR = "/tmp/downloads"


def cleanup():
    """自動清理超過 1 小時的暫存檔案"""
    while True:
        now = time.time()
        for f in glob.glob(f"{DOWNLOAD_DIR}/*"):
            try:
                if now - os.path.getmtime(f) > 3600:
                    os.remove(f)
            except OSError:
                pass
        time.sleep(600)


threading.Thread(target=cleanup, daemon=True).start()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/download")
async def download(url: str, token: str = Header(...)):
    if token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    file_id = str(uuid.uuid4())
    outtmpl = f"{DOWNLOAD_DIR}/{file_id}.%(ext)s"

    opts = {
        "outtmpl": outtmpl,
        "format": "best[filesize<500M]",
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "video")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    files = glob.glob(f"{DOWNLOAD_DIR}/{file_id}.*")
    if not files:
        raise HTTPException(status_code=500, detail="Download failed")

    filepath = files[0]
    ext = os.path.splitext(filepath)[1]

    return {
        "file_id": f"{file_id}{ext}",
        "title": title,
    }


@app.get("/file/{file_id}")
async def get_file(file_id: str, token: str = Header(...)):
    if token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 防止路徑穿越攻擊
    if "/" in file_id or "\\" in file_id or ".." in file_id:
        raise HTTPException(status_code=400, detail="Invalid file_id")

    filepath = os.path.join(DOWNLOAD_DIR, file_id)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filepath, filename=file_id)
