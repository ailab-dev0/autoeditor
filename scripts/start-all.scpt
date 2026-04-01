-- EditorLens MK-12 — Start All Servers
-- Double-click this file or run: osascript scripts/start-all.scpt

set projectRoot to "/Users/miles/dev/autoeditor"

-- Tab 1: MinIO (Docker)
tell application "Terminal"
	activate
	do script "cd " & projectRoot & " && echo '🟢 Starting MinIO...' && docker start minio 2>/dev/null || docker run -d --name minio -p 9000:9000 -p 9001:9001 -v minio_data:/data -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data --console-address ':9001' && echo '✅ MinIO running on :9000'"
	set miniTab to front window
end tell

delay 2

-- Tab 2: Backend
tell application "Terminal"
	do script "cd " & projectRoot & "/mk12-backend && echo '🟢 Starting Backend...' && npx tsx src/server.ts"
	set backendTab to front window
end tell

delay 3

-- Tab 3: Dashboard
tell application "Terminal"
	do script "cd " & projectRoot & "/mk12-dashboard && echo '🟢 Starting Dashboard...' && npx next dev --port 3000"
	set dashTab to front window
end tell

delay 1

-- Tab 4: Animation Engine
tell application "Terminal"
	do script "cd " & projectRoot & "/mk12-animation-engine && echo '🟢 Starting Animation Engine...' && npx tsx src/api/server.ts"
	set animTab to front window
end tell

delay 2

-- Summary
tell application "Terminal"
	do script "echo '' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && echo '  EditorLens MK-12 — All Servers Running' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && echo '' && echo '  MinIO:      http://localhost:9000' && echo '  Backend:    http://localhost:8000' && echo '  Dashboard:  http://localhost:3000' && echo '  Animation:  http://localhost:4200' && echo '' && echo '  Health:     http://localhost:8000/api/health' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && echo ''"
end tell
