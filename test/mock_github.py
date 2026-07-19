#!/usr/bin/env python3
"""Tiny mock of the GitHub Gist API for testing the baby tracker app."""
import json, uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

GISTS = {}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _auth_ok(self):
        a = self.headers.get('Authorization', '')
        return a.startswith('token ghp_') or a.startswith('token ghs_')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if not self._auth_ok(): return self._json(401, {'message': 'Bad credentials'})
        if self.path.startswith('/gists/'):
            gid = self.path.split('/')[2].split('?')[0]
            if gid not in GISTS: return self._json(404, {'message': 'Not Found'})
            return self._json(200, GISTS[gid])
        if self.path.startswith('/gists'):
            return self._json(200, list(GISTS.values()))
        self._json(404, {'message': 'Not Found'})

    def _body(self):
        n = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(n) or b'{}')

    def do_POST(self):
        if not self._auth_ok(): return self._json(401, {'message': 'Bad credentials'})
        if self.path.startswith('/gists'):
            b = self._body()
            gid = uuid.uuid4().hex
            files = {k: {'filename': k, 'content': v['content'], 'truncated': False,
                         'raw_url': f'http://localhost:8788/raw/{gid}/{k}'}
                     for k, v in b.get('files', {}).items()}
            GISTS[gid] = {'id': gid, 'description': b.get('description', ''),
                          'public': b.get('public', False), 'files': files}
            return self._json(201, GISTS[gid])
        self._json(404, {'message': 'Not Found'})

    def do_PATCH(self):
        if not self._auth_ok(): return self._json(401, {'message': 'Bad credentials'})
        if self.path.startswith('/gists/'):
            gid = self.path.split('/')[2]
            if gid not in GISTS: return self._json(404, {'message': 'Not Found'})
            b = self._body()
            for k, v in b.get('files', {}).items():
                GISTS[gid]['files'][k] = {'filename': k, 'content': v['content'], 'truncated': False,
                                          'raw_url': f'http://localhost:8788/raw/{gid}/{k}'}
            return self._json(200, GISTS[gid])
        self._json(404, {'message': 'Not Found'})

if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 8788), H).serve_forever()
