"""Server Python lokal untuk Sehat Bersama – Puskesmas Arbes.
Jalankan: python app.py. Tidak membutuhkan pip atau Node.js.
Data klinis browser hanya untuk demonstrasi, bukan produksi.
"""
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'server-data'
ACCOUNT_FILE = DATA_DIR / 'firebase-profiles.json'
HOST = '127.0.0.1'
ROLES = ('admin', 'pendaftaran', 'dokter', 'perawat', 'farmasi', 'kasir', 'pasien')
POLIS = ('umum', 'gigi', 'kia', 'lansia', 'gizi')
DEMO = [('admin', 'admin123', 'Sari Dewi, S.Kom.'),
        ('pendaftaran', '123456', 'Nurul Hidayah'), ('dokter', '123456', 'dr. Rizky Pratama'),
        ('perawat', '123456', 'Ani Rahmawati, S.Kep.'), ('farmasi', '123456', 'Dedi Kurniawan, S.Farm.'),
        ('kasir', '123456', 'Maya Sari')]

# Membaca .env tanpa library tambahan.
if (ROOT / '.env').is_file():
    for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
        match = re.fullmatch(r'\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*', line)
        if match:
            key, value = match.groups()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
                value = value[1:-1]
            os.environ.setdefault(key, value)
PORT = int(os.getenv('PORT') or '4173')
LOCK = threading.RLock()
accounts, sessions, rate_limits = [], {}, {}

class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def string(value):
    return value if isinstance(value, str) else ''

def field(data, key):
    return string(data.get(key))

def normalized(value):
    return string(value).strip().lower()

def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return f'scrypt:{salt}:{digest.hex()}'

def verify_password(password, digest):
    try:
        kind, salt, expected = digest.split(':')
        if kind != 'scrypt' or len(password) > 128:
            return False
        actual = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, AttributeError):
        return False

def save_accounts():
    temp = ACCOUNT_FILE.with_suffix('.tmp')
    temp.write_text(json.dumps(accounts, ensure_ascii=False, indent=2), encoding='utf-8')
    try:
        temp.chmod(0o600)
    except OSError:
        pass
    temp.replace(ACCOUNT_FILE)

def initialize_accounts():
    DATA_DIR.mkdir(exist_ok=True)
    if ACCOUNT_FILE.exists():
        saved = json.loads(ACCOUNT_FILE.read_text(encoding='utf-8'))
        if not isinstance(saved, list):
            raise ValueError('Format firebase-profiles.json tidak valid.')
        accounts[:] = saved
    for role, password, name in DEMO:
        if not any(u['username'] == role for u in accounts):
            accounts.append(dict(id='u-'+role, username=role, hash=password_hash(password), name=name,
                email='', phone='', role=role, poli='umum' if role == 'dokter' else None,
                active=True, demo=True, createdAt=now_iso()))
    save_accounts()

def firebase_configured():
    key = os.getenv('FIREBASE_API_KEY', '')
    return bool(key and 'ISI_' not in key)

# Firebase Identity Toolkit REST API: HTTPS, tanpa Firebase CLI/SDK.
def firebase(action, payload):
    if not firebase_configured():
        raise ApiError(503, 'Isi FIREBASE_API_KEY pada .env, lalu restart server.')
    url = 'https://identitytoolkit.googleapis.com/v1/accounts:' + action + '?' + urlencode({'key': os.environ['FIREBASE_API_KEY']})
    req = Request(url, data=json.dumps(payload).encode(), headers={'Content-Type':'application/json','X-Firebase-Locale':'id'}, method='POST')
    try:
        with urlopen(req, timeout=20) as response:
            return json.load(response)
    except HTTPError as exc:
        try:
            code = json.load(exc).get('error', {}).get('message', '').split(' : ')[0]
        except (ValueError, AttributeError):
            code = ''
        messages = {'EMAIL_EXISTS':'Email sudah terdaftar di Firebase.', 'INVALID_LOGIN_CREDENTIALS':'Email/username atau password tidak sesuai.',
            'INVALID_PASSWORD':'Password tidak sesuai.', 'EMAIL_NOT_FOUND':'Akun tidak ditemukan.', 'USER_DISABLED':'Akun dinonaktifkan.',
            'OPERATION_NOT_ALLOWED':'Aktifkan Email/Password di Firebase Authentication.', 'API_KEY_INVALID':'API key Firebase tidak valid.',
            'INVALID_API_KEY':'API key Firebase tidak valid.', 'INVALID_EMAIL':'Alamat email tidak valid.', 'WEAK_PASSWORD':'Password tidak memenuhi kebijakan Firebase.',
            'TOO_MANY_ATTEMPTS_TRY_LATER':'Terlalu banyak percobaan. Coba lagi nanti.', 'QUOTA_EXCEEDED':'Kuota Firebase tercapai. Coba lagi nanti.'}
        raise ApiError(429 if exc.code == 429 else 400, messages.get(code, 'Firebase menolak permintaan. Periksa konfigurasi Authentication.')) from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise ApiError(502, 'Tidak dapat terhubung ke Firebase. Periksa internet dan coba lagi.') from None

def allow(key, limit, seconds):
    now = time.monotonic()
    rows = [t for t in rate_limits.get(key, []) if now - t < seconds]
    if len(rows) >= limit:
        return False
    rate_limits[key] = rows + [now]
    return True

def public_user(user):
    result = {key: user.get(key) for key in ('id','username','name','email','phone','role','poli','active','createdAt')}
    result['demo'] = bool(user.get('demo'))
    return result

def visible_users(user):
    return [public_user(u) for u in accounts if bool(u.get('demo')) == bool(user.get('demo'))] if user['role'] == 'admin' else []

def account_by_identifier(identifier):
    value = normalized(identifier)
    return next((u for u in accounts if u['username'] == value or (u.get('email') and u['email'] == value)), None)

def invalidate_sessions(user_id):
    for key in list(sessions):
        if sessions[key]['userId'] == user_id:
            del sessions[key]

def send_reset(user):
    if user.get('demo'):
        raise ApiError(400, 'Akun demo tidak memiliki email Firebase. Daftar akun baru dengan email aktif.')
    if not allow('reset:' + user['id'], 3, 900):
        raise ApiError(429, 'Batas reset tercapai. Coba lagi dalam 15 menit.')
    firebase('sendOobCode', {'requestType':'PASSWORD_RESET', 'email':user['email']})

def valid_profile(name, phone):
    return 3 <= len(name) <= 120 and bool(re.fullmatch(r'\+?[0-9\s-]{9,20}', phone))

def valid_username(username):
    return bool(re.fullmatch(r'[a-z0-9._-]{3,30}', username))

def create_account(data):
    username, email = normalized(data.get('username')), normalized(data.get('email'))
    name, phone = field(data, 'name').strip(), field(data, 'phone').strip()
    password, role = field(data, 'password'), field(data, 'role')
    if role not in ROLES:
        raise ApiError(400, 'Peran tidak valid.')
    if not valid_username(username):
        raise ApiError(400, 'Username harus 3–30 karakter: huruf kecil, angka, titik, _ atau -.')
    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ApiError(400, 'Email tidak valid.')
    if not valid_profile(name, phone):
        raise ApiError(400, 'Periksa nama (3–120 karakter) dan nomor HP.')
    if not 8 <= len(password) <= 128:
        raise ApiError(400, 'Password harus 8–128 karakter.')
    if any(u['username'] == username or u.get('email') == email for u in accounts):
        raise ApiError(409, 'Username atau email sudah digunakan.')
    auth = firebase('signUp', {'email':email,'password':password,'returnSecureToken':True})
    user = dict(id='u-'+str(uuid.uuid4()), firebaseUid=auth['localId'], username=username, name=name, email=email, phone=phone,
                role=role, poli=(data.get('poli') if data.get('poli') in POLIS else 'umum') if role == 'dokter' else None,
                active=data.get('active') is not False, demo=False, createdAt=now_iso())
    accounts.append(user)
    save_accounts()
    return user

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def log_message(self, fmt, *args):
        # Tidak mencetak isi permintaan, password, token, atau email.
        pass

    def json_response(self, status, payload, cookie=None):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def ok(self, status=200, cookie=None, **payload):
        self.json_response(status, {'ok':True, **payload}, cookie)

    def token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            return cookie['pk_session'].value if 'pk_session' in cookie else ''
        except Exception:
            return ''

    def session_user(self):
        token = self.token()
        session = sessions.get(token)
        if not session or session['expiresAt'] < time.monotonic():
            sessions.pop(token, None)
            return None
        return next((u for u in accounts if u['id'] == session['userId'] and u['active']), None)

    def read_json(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise ApiError(400, 'Ukuran data tidak valid.')
        if not 0 <= length <= 12000:
            raise ApiError(413, 'Ukuran data terlalu besar.')
        try:
            data = json.loads(self.rfile.read(length) or b'{}')
            if not isinstance(data, dict):
                raise ValueError()
            return data
        except (ValueError, UnicodeError):
            raise ApiError(400, 'Format JSON tidak valid.') from None

    def api(self, endpoint):
        if self.command == 'GET' and endpoint == '/api/config':
            return self.ok(firebaseConfigured=firebase_configured())
        if self.command != 'POST':
            raise ApiError(405, 'Metode tidak diizinkan.')
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host',''):
            raise ApiError(403, 'Permintaan lintas situs ditolak.')
        if not allow('ip:'+self.client_address[0]+':'+endpoint, 300 if endpoint == '/api/auth/session' else 35, 900):
            raise ApiError(429, 'Terlalu banyak permintaan. Coba lagi nanti.')
        data = self.read_json()
        if endpoint == '/api/auth/login':
            user = account_by_identifier(data.get('username'))
            password = field(data, 'password')
            if not user or not user['active'] or len(password) > 128:
                raise ApiError(401, 'Username/email atau password tidak sesuai, atau akun tidak aktif.')
            if user.get('demo'):
                if not verify_password(password, user.get('hash')):
                    raise ApiError(401, 'Username atau password tidak sesuai.')
            else:
                auth = firebase('signInWithPassword', {'email':user['email'],'password':password,'returnSecureToken':True})
                if auth.get('localId') != user['firebaseUid']:
                    raise ApiError(401, 'Identitas Firebase tidak sesuai profil lokal.')
            token = secrets.token_hex(32)
            sessions[token] = {'userId':user['id'],'expiresAt':time.monotonic()+43200}
            user['lastLogin'] = now_iso()
            save_accounts()
            return self.ok(cookie=f'pk_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200', user=public_user(user), users=visible_users(user))
        if endpoint == '/api/auth/session':
            user = self.session_user()
            if not user:
                raise ApiError(401, 'Silakan login kembali.')
            return self.ok(user=public_user(user), users=visible_users(user))
        if endpoint == '/api/auth/logout':
            sessions.pop(self.token(), None)
            return self.ok(cookie='pk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
        if endpoint == '/api/auth/register':
            role = field(data, 'role')
            if role not in ROLES:
                raise ApiError(400, 'Peran tidak valid.')
            key = 'ADMIN_REGISTRATION_CODE' if role == 'admin' else 'STAFF_REGISTRATION_CODE'
            code = os.getenv(key, '')
            if role != 'pasien' and (len(code) < 12 or not hmac.compare_digest(field(data,'staffCode').encode(), code.encode())):
                raise ApiError(403, 'Kode undangan peran tidak sesuai atau belum diatur pada .env.')
            user = create_account({**data, 'active':True})
            return self.ok(201, user=public_user(user), message='Akun berhasil dibuat. Silakan masuk.')
        if endpoint == '/api/auth/request-reset':
            if not firebase_configured():
                raise ApiError(503, 'Firebase belum dikonfigurasi. Isi FIREBASE_API_KEY pada .env.')
            user = account_by_identifier(data.get('identifier'))
            if user and user['active']:
                send_reset(user)
            return self.ok(message='Jika akun Firebase aktif dan terdaftar, tautan reset akan dikirim. Periksa Inbox atau Spam.')
        actor = self.session_user()
        if not actor:
            raise ApiError(401, 'Sesi berakhir. Silakan login kembali.')
        if endpoint == '/api/auth/change-password':
            if actor.get('demo'):
                raise ApiError(400, 'Password demo tetap. Daftar akun Firebase untuk mengubah password.')
            password = field(data, 'newPassword')
            if not 8 <= len(password) <= 128:
                raise ApiError(400, 'Password baru harus 8–128 karakter.')
            auth = firebase('signInWithPassword', {'email':actor['email'],'password':field(data,'currentPassword'),'returnSecureToken':True})
            if auth.get('localId') != actor['firebaseUid']:
                raise ApiError(401, 'Identitas Firebase tidak cocok.')
            firebase('update', {'idToken':auth['idToken'],'password':password,'returnSecureToken':True})
            invalidate_sessions(actor['id'])
            return self.ok(message='Password berhasil diubah. Silakan login kembali.')
        if endpoint == '/api/auth/update-profile':
            name, phone = field(data,'name').strip(), field(data,'phone').strip()
            if not valid_profile(name,phone):
                raise ApiError(400, 'Periksa nama dan nomor telepon.')
            if actor.get('demo'):
                raise ApiError(403, 'Profil demo tidak dapat diubah di server.')
            actor.update(name=name,phone=phone)
            save_accounts()
            return self.ok(user=public_user(actor))
        if not endpoint.startswith('/api/admin/'):
            raise ApiError(404, 'API tidak ditemukan.')
        if actor['role'] != 'admin' or actor.get('demo'):
            raise ApiError(403, 'Masuk dengan akun administrator Firebase untuk mengelola akun terdaftar.')
        if endpoint == '/api/admin/create-user':
            return self.ok(201, user=public_user(create_account(data)))
        user = next((u for u in accounts if u['id'] == data.get('id') and not u.get('demo')), None)
        if not user:
            raise ApiError(404, 'Akun Firebase tidak ditemukan.')
        if endpoint == '/api/admin/send-reset':
            if not user['active']:
                raise ApiError(400, 'Akun tidak aktif.')
            send_reset(user)
            return self.ok(message='Permintaan tautan reset diterima Firebase. Minta pengguna memeriksa email.')
        if endpoint == '/api/admin/toggle-user':
            if actor['id'] == user['id']:
                raise ApiError(400, 'Tidak dapat menonaktifkan akun sendiri.')
            user['active'] = not user['active']
            save_accounts()
            if not user['active']:
                invalidate_sessions(user['id'])
            return self.ok(user=public_user(user))
        if endpoint == '/api/admin/update-user':
            name, phone, username = field(data,'name').strip(), field(data,'phone').strip(), normalized(data.get('username'))
            role = field(data,'role')
            if normalized(data.get('email')) != user['email'] or data.get('password'):
                raise ApiError(400, 'Email tetap pada akun Firebase; gunakan kirim tautan reset untuk mengganti password.')
            if role not in ROLES or not valid_username(username) or not valid_profile(name,phone):
                raise ApiError(400, 'Lengkapi profil dengan benar.')
            if user['id'] == actor['id'] and role != 'admin':
                raise ApiError(403, 'Tidak dapat mengubah peran administrator sendiri.')
            if any(u['id'] != user['id'] and u['username'] == username for u in accounts):
                raise ApiError(409, 'Username sudah digunakan.')
            user.update(name=name,phone=phone,username=username,role=role,poli=(data.get('poli') if data.get('poli') in POLIS else 'umum') if role == 'dokter' else None)
            save_accounts()
            if user['id'] != actor['id']:
                invalidate_sessions(user['id'])
            return self.ok(user=public_user(user))
        raise ApiError(404, 'API tidak ditemukan.')

    def static(self, path):
        if self.command not in ('GET','HEAD'):
            raise ApiError(405, 'Metode tidak diizinkan.')
        if path in ('/', '/index.html'):
            file = ROOT / 'index.html'
        elif path.startswith(('/css/','/js/','/docs/')) and '\\' not in path and not any(p.startswith('.') for p in path.split('/')):
            file = (ROOT / path.lstrip('/')).resolve()
            if not any(folder in file.parents for folder in (ROOT/'css',ROOT/'js',ROOT/'docs')):
                raise ApiError(404, 'Tidak ditemukan.')
        else:
            raise ApiError(404, 'Tidak ditemukan.')
        if not file.is_file():
            raise ApiError(404, 'Tidak ditemukan.')
        body = file.read_bytes()
        mime = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.md':'text/plain'}.get(file.suffix, mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        self.send_response(200)
        self.send_header('Content-Type', mime + ('; charset=utf-8' if mime.startswith('text/') else ''))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control','no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','same-origin')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def handle_request(self):
        try:
            # Hanya menerima Host loopback untuk mengurangi risiko DNS rebinding.
            host = self.headers.get('Host','').lower()
            if host not in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}:
                raise ApiError(403, 'Gunakan alamat localhost atau 127.0.0.1.')
            path = unquote(urlsplit(self.path).path)
            if path.startswith('/api/'):
                # Serialisasi operasi akun untuk menghindari race saat menyimpan profil.
                with LOCK:
                    self.api(path)
            else:
                self.static(path)
        except ApiError as error:
            self.json_response(error.status, {'ok':False,'message':str(error)})
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        except Exception as error:
            print('Kesalahan server:', type(error).__name__, flush=True)
            self.json_response(500, {'ok':False,'message':'Terjadi kesalahan server lokal.'})

    do_GET = do_HEAD = do_POST = do_PUT = do_DELETE = do_OPTIONS = handle_request


def main():
    initialize_accounts()
    with ThreadingHTTPServer((HOST, PORT), Handler) as server:
        print(f'Sehat Bersama - Puskesmas Arbes: http://{HOST}:{PORT}', flush=True)
        print('Firebase: ' + ('API key tersedia (belum diuji).' if firebase_configured() else 'belum dikonfigurasi; demo lokal tetap tersedia.'), flush=True)
        print('Tekan Ctrl+C untuk berhenti.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nServer dihentikan.')

if __name__ == '__main__':
    main()
