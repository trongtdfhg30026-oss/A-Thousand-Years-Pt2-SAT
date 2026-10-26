# -*- coding: utf-8 -*-
import os, sys, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
if not os.path.isfile(os.path.join(DIRECTORY, 'index.html')):
    cand = r'C:\Users\trong\OneDrive\TILIU~1\ChatGPT\LIGHTU~1'
    if os.path.isfile(os.path.join(cand, 'index.html')):
        DIRECTORY = cand

os.chdir(DIRECTORY)

class RangeRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def send_head(self):
        if 'Range' not in self.headers:
            return super().send_head()

        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            return super().send_head()

        file_size = os.path.getsize(path)
        range_header = self.headers.get('Range', '')
        range_match = re.match(r'^bytes=(\d*)-(\d*)$', range_header.strip())

        if not range_match:
            return super().send_head()

        first, last = range_match.groups()
        if first:
            start = int(first)
            end = int(last) if last else file_size - 1
        elif last:
            start = file_size - int(last)
            end = file_size - 1
        else:
            return super().send_head()

        if start >= file_size or end >= file_size or start > end:
            self.send_error(416, 'Requested Range Not Satisfiable')
            return None

        content_length = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
        self.send_header('Content-Length', str(content_length))
        self.end_headers()

        f = open(path, 'rb')
        f.seek(start)
        return RangeFileWrapper(f, content_length)

class RangeFileWrapper:
    def __init__(self, file_obj, length):
        self.file_obj = file_obj
        self.remaining = length

    def read(self, size=-1):
        if self.remaining <= 0:
            return b''
        if size < 0 or size > self.remaining:
            size = self.remaining
        data = self.file_obj.read(size)
        self.remaining -= len(data)
        return data

    def close(self):
        self.file_obj.close()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server_address = ('0.0.0.0', port)
    httpd = ThreadingHTTPServer(server_address, RangeRequestHandler)
    print(f'Serving HTTP on 0.0.0.0 port {port} from {DIRECTORY} ...')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
