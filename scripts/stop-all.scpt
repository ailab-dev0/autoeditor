-- EditorLens MK-12 — Stop All Servers
-- Double-click this file or run: osascript scripts/stop-all.scpt

tell application "Terminal"
	activate
	do script "echo '🔴 Stopping all EditorLens servers...' && lsof -ti:8000 | xargs kill -15 2>/dev/null; lsof -ti:3000 | xargs kill -15 2>/dev/null; lsof -ti:4200 | xargs kill -15 2>/dev/null; docker stop minio 2>/dev/null; sleep 2 && echo '' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && echo '  All servers stopped.' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && echo ''"
end tell
