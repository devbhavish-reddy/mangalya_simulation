"""Tiny no-dependency development server for the Mangalyaan systems demo."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import mimetypes

ROOT = Path(__file__).parent


class DemoHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean_path = path.split("?", 1)[0].split("#", 1)[0]
        if clean_path in ("", "/"):
            clean_path = "/index.html"
        return str(ROOT / clean_path.lstrip("/"))

    def do_GET(self):
        if self.path.startswith("/api/mission"):
            payload = {
                "mission": "Mars Orbiter Mission", "shortName": "Mangalyaan",
                "launch": "5 November 2013", "marsOrbit": "24 September 2014",
                "purpose": "Study Mars from orbit and demonstrate deep-space technology",
            }
            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    mimetypes.add_type("application/javascript", ".js")
    print("Mangalyaan demo: http://localhost:8000")
    ThreadingHTTPServer(("", 8000), DemoHandler).serve_forever()
