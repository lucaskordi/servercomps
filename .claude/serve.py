"""Servidor estático local sem cache (evita CSS/JS antigos durante o desenvolvimento)."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
