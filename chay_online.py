# -*- coding: utf-8 -*-
import sys, os, time, subprocess, re, http.client, webbrowser, threading

sys.stdout.reconfigure(encoding='utf-8')

PROJECT_DIR = r'C:\Users\trong\OneDrive\TILIU~1\ChatGPT\LIGHTU~1'
if not os.path.isfile(os.path.join(PROJECT_DIR, 'index.html')):
    PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
    if not os.path.isfile(os.path.join(PROJECT_DIR, 'index.html')):
        PROJECT_DIR = r'C:\Users\trong\OneDrive\Tài liệu\ChatGPT\Light up'

os.chdir(PROJECT_DIR)
PORT = 8765
SERVER_SCRIPT = os.path.join(PROJECT_DIR, 'server.py')
CLOUDFLARED_EXE = os.path.join(PROJECT_DIR, 'cloudflared.exe')

def check_local_server(port):
    try:
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
        conn.request('GET', '/index.html')
        res = conn.getresponse()
        return res.status == 200
    except:
        return False

def ensure_server():
    if check_local_server(PORT):
        print(f'[+] May chu Local tai port {PORT} dang hoat dong tot (200 OK).')
        return None
    print(f'[*] Dang khoi dong may chu Local tai port {PORT}...')
    proc = subprocess.Popen([sys.executable, SERVER_SCRIPT, str(PORT)], cwd=PROJECT_DIR)
    for _ in range(20):
        time.sleep(0.3)
        if check_local_server(PORT):
            print(f'[+] May chu Local tai port {PORT} da san sang!')
            return proc
    print(f'[!] Canh bao: May chu Local khoi dong cham, van tiep tuc...')
    return proc

def main():
    print('=' * 72)
    print('  KHOI DONG SITE ONLINE - A THOUSAND YEARS 3 BE SAT')
    print('=' * 72)
    print(f'[*] Thu muc du an: {PROJECT_DIR}')

    server_proc = ensure_server()

    local_url = f'http://localhost:{PORT}/index.html'
    sheet_local_url = f'http://localhost:{PORT}/download_sheet.html'
    pdf_local_url = f'http://localhost:{PORT}/A_Thousand_Years_Pt2_Sheet_Music_3Be_SAT.pdf'

    online_url = None
    cf_proc = None

    if os.path.isfile(CLOUDFLARED_EXE):
        print('[*] Dang tao ket noi Cloudflare Tunnel (Online)...')
        cf_proc = subprocess.Popen(
            [CLOUDFLARED_EXE, 'tunnel', '--url', f'http://127.0.0.1:{PORT}'],
            cwd=PROJECT_DIR,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL
        )

        found_event = threading.Event()
        extracted_url = []

        def drain_stderr():
            try:
                for line in iter(cf_proc.stderr.readline, b''):
                    text = line.decode('utf-8', errors='ignore')
                    if not extracted_url:
                        m = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', text)
                        if m:
                            extracted_url.append(m.group(0))
                            found_event.set()
            except:
                pass

        t = threading.Thread(target=drain_stderr, daemon=True)
        t.start()

        found_event.wait(timeout=15)
        if extracted_url:
            online_url = extracted_url[0]
            print(f'[+] Da tao xong duong link Online: {online_url}')
        else:
            print('[!] Chua nhan dien duoc link Cloudflare ngay, van tiep tuc...')
    else:
        print('[-] Khong tim thay cloudflared.exe, chi mo link Local.')

    print('\n' + '=' * 72)
    print('  SITE DA SAN SANG HOAT DONG!')
    print('=' * 72)
    if online_url:
        full_online_url = f'{online_url}/index.html'
        sheet_online_url = f'{online_url}/download_sheet.html'
        pdf_online_url = f'{online_url}/A_Thousand_Years_Pt2_Sheet_Music_3Be_SAT.pdf'
        print(f'  [ONLINE] May phat nhac : {full_online_url}')
        print(f'  [ONLINE] Xem & in sheet: {sheet_online_url}')
        print(f'  [ONLINE] Tai file PDF  : {pdf_online_url}')
        print('-' * 72)
    print(f'  [LOCAL]  May phat nhac : {local_url}')
    print(f'  [LOCAL]  Xem & in sheet: {sheet_local_url}')
    print(f'  [LOCAL]  Tai file PDF  : {pdf_local_url}')
    print('=' * 72)
    print('  Luu y: Giu cua so nay mo de duy tri link Online.')
    print('=' * 72 + '\n')

    lines = ['LINK TRUY CAP SITE - A THOUSAND YEARS 3 BE SAT', '=' * 50]
    if online_url:
        lines.append('[DUNG DUOC CHO CA DIEN THOAI VA MAY TINH]')
        lines.append(f'- May phat nhac online: {full_online_url}')
        lines.append(f'- Xem va in sheet online: {sheet_online_url}')
        lines.append(f'- Tai truc tiep PDF: {pdf_online_url}')
        lines.append('')
    lines.append('[DUNG TREN MAY TINH NAY (LOCAL)]')
    lines.append(f'- May phat nhac local: {local_url}')
    lines.append(f'- Xem va in sheet local: {sheet_local_url}')
    lines.append(f'- Tai file PDF local: {pdf_local_url}')
    urls_txt = '\n'.join(lines) + '\n'

    user_home = os.environ.get('USERPROFILE', r'C:\Users\trong')
    for target_dir in [PROJECT_DIR, os.path.join(user_home, 'Downloads'), os.path.join(user_home, 'Desktop')]:
        try:
            with open(os.path.join(target_dir, 'site_urls.txt'), 'w', encoding='utf-8') as f:
                f.write(urls_txt)
        except Exception as e:
            pass

    target_open = full_online_url if online_url else local_url
    try:
        webbrowser.open(target_open)
    except:
        pass

    try:
        while True:
            time.sleep(1)
            if server_proc and server_proc.poll() is not None:
                server_proc = subprocess.Popen([sys.executable, SERVER_SCRIPT, str(PORT)], cwd=PROJECT_DIR)
    except KeyboardInterrupt:
        print('\n[*] Dang dung duong truyen...')
    finally:
        if cf_proc:
            try:
                cf_proc.terminate()
            except:
                pass
        if server_proc:
            try:
                server_proc.terminate()
            except:
                pass

if __name__ == '__main__':
    main()
