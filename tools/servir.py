"""Servidor local do site, com cabeçalho "sem cache": o navegador sempre confere se os arquivos mudaram.
O servidor simples do Python (http.server) deixa o navegador reaproveitar arquivos antigos, o que, depois de várias
atualizações, pode misturar versões de módulos e impedir a cena 3D de iniciar.

  python tools/servir.py [porta]      (padrão 8765; o servir.bat usa este)
"""
import http.server, os, socketserver, sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
                      '.webp': 'image/webp', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    os.chdir(RAIZ)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', porta), Handler) as s:
        print(f'Servindo em http://localhost:{porta}  (Ctrl+C para parar)')
        s.serve_forever()
