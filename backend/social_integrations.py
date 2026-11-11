"""
Social Media Integration Architecture for SocialSync
Implements official OAuth 2.0, publishing, scheduled publishing, and analytics
for Instagram, Facebook Pages, and YouTube, while keeping Sandbox Mode strictly separate.
"""

from datetime import datetime, timedelta, timezone
import http.client
import ipaddress
import json
import mimetypes
import os
import random
import socket
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from env_loader import load_env_file
from token_crypto import redact_secrets

load_env_file()

DEFAULT_META_VERSION = os.environ.get("META_GRAPH_VERSION", "v25.0")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
YOUTUBE_UPLOAD_INIT_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
YOUTUBE_ANALYTICS_URL = "https://youtubeanalytics.googleapis.com/v2/reports"

INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com"

FACEBOOK_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "read_insights",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
]

INSTAGRAM_LOGIN_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
]

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]

PLATFORM_CAPABILITIES = {
    "Instagram": {
        "official_api": True,
        "supported_media": ["image", "video"],
        "supports_text_only": False,
        "requires_public_media_url": True,
        "notes": "Requires Instagram Business/Creator account and publicly accessible HTTPS image or video URL (published as Reel for video).",
    },
    "Facebook": {
        "official_api": True,
        "supported_media": ["text", "image", "video"],
        "supports_text_only": True,
        "requires_public_media_url": False,
        "notes": "Supports text posts, photos, and videos to managed Facebook Pages (supports both local uploads and public URLs).",
    },
    "YouTube": {
        "official_api": True,
        "supported_media": ["video"],
        "supports_text_only": False,
        "requires_public_media_url": False,
        "notes": "Supports video uploads via YouTube Data API v3 (supports local uploaded videos or remote video URLs; unverified Google apps default uploads to private).",
    },
    "X": {
        "official_api": False,
        "supported_media": ["text", "image"],
        "supports_text_only": True,
        "requires_public_media_url": False,
        "notes": "Sandbox simulation only in this release.",
    },
    "LinkedIn": {
        "official_api": False,
        "supported_media": ["text", "image"],
        "supports_text_only": True,
        "requires_public_media_url": False,
        "notes": "Sandbox simulation only in this release.",
    },
    "TikTok": {
        "official_api": False,
        "supported_media": ["video", "image"],
        "supports_text_only": False,
        "requires_public_media_url": False,
        "notes": "Sandbox simulation only in this release.",
    },
}


def get_meta_version() -> str:
    return os.environ.get("META_GRAPH_VERSION", DEFAULT_META_VERSION) or "v25.0"


def get_oauth_redirect_base() -> str:
    return os.environ.get("OAUTH_REDIRECT_BASE", "http://127.0.0.1:5000").rstrip("/")


def get_frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def get_public_base_url() -> str:
    return os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")


def get_oauth_config_status() -> dict:
    """Returns non-secret credential readiness for each OAuth provider."""
    meta_id = bool(os.environ.get("META_APP_ID"))
    meta_secret = bool(os.environ.get("META_APP_SECRET"))
    ig_id = bool(os.environ.get("INSTAGRAM_APP_ID"))
    ig_secret = bool(os.environ.get("INSTAGRAM_APP_SECRET"))
    google_id = bool(os.environ.get("GOOGLE_CLIENT_ID"))
    google_secret = bool(os.environ.get("GOOGLE_CLIENT_SECRET"))

    redirect_base = get_oauth_redirect_base()
    public_base = get_public_base_url()

    meta_missing = []
    if not meta_id:
        meta_missing.append("META_APP_ID")
    if not meta_secret:
        meta_missing.append("META_APP_SECRET")

    ig_direct_missing = []
    if not ig_id:
        ig_direct_missing.append("INSTAGRAM_APP_ID")
    if not ig_secret:
        ig_direct_missing.append("INSTAGRAM_APP_SECRET")

    google_missing = []
    if not google_id:
        google_missing.append("GOOGLE_CLIENT_ID")
    if not google_secret:
        google_missing.append("GOOGLE_CLIENT_SECRET")

    return {
        "Facebook": {
            "configured": meta_id and meta_secret,
            "missing_env": meta_missing,
            "redirect_uri": f"{redirect_base}/api/oauth/facebook/callback",
            "required_scopes": FACEBOOK_SCOPES[:4],
            "graph_version": get_meta_version(),
        },
        "Instagram": {
            "configured": (meta_id and meta_secret) or (ig_id and ig_secret),
            "meta_login_configured": meta_id and meta_secret,
            "instagram_login_configured": ig_id and ig_secret,
            "missing_env": meta_missing if not (ig_id and ig_secret) else [],
            "optional_instagram_login_missing_env": ig_direct_missing,
            "redirect_uri": f"{redirect_base}/api/oauth/instagram/callback",
            "required_scopes": (
                INSTAGRAM_LOGIN_SCOPES
                if (ig_id and ig_secret and not (meta_id and meta_secret))
                else ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"]
            ),
            "public_media_url_configured": bool(public_base),
            "public_base_url": public_base or None,
        },
        "YouTube": {
            "configured": google_id and google_secret,
            "missing_env": google_missing,
            "redirect_uri": f"{redirect_base}/api/oauth/youtube/callback",
            "required_scopes": YOUTUBE_SCOPES,
        },
    }


def _extract_api_error(raw_body: str, status_code: int) -> str:
    try:
        data = json.loads(raw_body)
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                msg = err.get("message") or ""
                code = err.get("code")
                subcode = err.get("error_subcode")
                user_msg = err.get("error_user_msg") or ""
                details = f"HTTP {status_code}"
                if code:
                    details += f" (code {code}" + (f", subcode {subcode}" if subcode else "") + ")"
                combined = msg
                if user_msg and user_msg not in msg:
                    combined = f"{msg} — {user_msg}" if msg else user_msg
                return redact_secrets(f"{details}: {combined}" if combined else details)
            if isinstance(err, str):
                desc = data.get("error_description") or ""
                return redact_secrets(f"HTTP {status_code}: {err}" + (f" ({desc})" if desc else ""))
            if data.get("error_message"):
                return redact_secrets(f"HTTP {status_code}: {data['error_message']}")
    except Exception:
        pass
    snippet = (raw_body or "").strip()[:300]
    return redact_secrets(f"HTTP {status_code}: {snippet or 'Unknown API error'}")


def _is_auth_revoked_error(status_code: int, parsed_data: dict | None, err_msg: str | None) -> bool:
    if status_code == 401:
        return True
    if isinstance(parsed_data, dict):
        err = parsed_data.get("error")
        if isinstance(err, dict) and err.get("code") == 190:
            return True
        if err == "invalid_grant":
            return True
    if err_msg and ("code 190" in err_msg or "invalid_grant" in err_msg):
        return True
    return False


def _is_disallowed_ip(ip_obj) -> bool:
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped is not None:
        if _is_disallowed_ip(ip_obj.ipv4_mapped):
            return True
    return bool(
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )


def _resolve_and_validate_safe_url(url: str) -> tuple[bool, str, dict | None]:
    """
    Validates remote URLs against SSRF and resolves DNS once so outbound callers
    can pin the validated IP address and avoid DNS-rebinding TOCTOU.
    """
    if not url or not isinstance(url, str):
        return False, "Missing URL.", None
    parsed = urllib.parse.urlparse(url.strip())
    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        return False, f"Unsupported URL scheme '{parsed.scheme}'.", None
    if parsed.username or parsed.password:
        return False, "Embedded URL credentials are not permitted.", None
    hostname = parsed.hostname
    if not hostname:
        return False, "URL hostname is missing.", None
    if hostname.lower().rstrip(".") in ("localhost", "localhost.localdomain"):
        return False, "Refusing local/loopback remote URL.", None

    try:
        port = parsed.port or (443 if scheme == "https" else 80)
        if port < 1 or port > 65535:
            return False, "Invalid URL port.", None
    except ValueError:
        return False, "Invalid URL port.", None

    try:
        addr_infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        return False, f"DNS lookup failed for remote media host: {exc}", None

    if not addr_infos:
        return False, "Remote hostname resolved to no addresses.", None

    validated_ips = []
    for info in addr_infos:
        ip_str = info[4][0].split("%", 1)[0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            return False, "Invalid resolved remote IP address.", None
        if _is_disallowed_ip(ip_obj):
            return False, "Refusing remote media fetch from private or internal IP space.", None
        if ip_str not in validated_ips:
            validated_ips.append(ip_str)

    path_query = parsed.path or "/"
    if parsed.query:
        path_query = f"{path_query}?{parsed.query}"

    return True, "", {
        "scheme": scheme,
        "hostname": hostname,
        "netloc": parsed.netloc,
        "port": port,
        "path_query": path_query,
        "pinned_ip": validated_ips[0],
        "all_ips": validated_ips,
    }


def _validate_safe_remote_url(url: str) -> tuple[bool, str]:
    """Validates remote media URLs against SSRF (blocks non-HTTP(S) and private/loopback/link-local IPs)."""
    ok, err, _ = _resolve_and_validate_safe_url(url)
    return ok, err


class _PinnedHTTPConnection(http.client.HTTPConnection):
    """HTTPConnection subclass that connects directly to a pre-validated IP to prevent DNS rebinding."""

    def __init__(self, host: str, port: int, pinned_ip: str, timeout: int = 60):
        super().__init__(host, port=port, timeout=timeout)
        self._pinned_ip = pinned_ip

    def connect(self):
        self.sock = self._create_connection((self._pinned_ip, self.port), self.timeout, self.source_address)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPSConnection subclass that connects to a pinned IP while validating TLS cert & SNI for original host."""

    def __init__(self, host: str, port: int, pinned_ip: str, timeout: int = 60, context=None):
        ctx = context or ssl.create_default_context()
        super().__init__(host, port=port, timeout=timeout, context=ctx)
        self._pinned_ip = pinned_ip
        self._sni_host = host

    def connect(self):
        raw_sock = self._create_connection((self._pinned_ip, self.port), self.timeout, self.source_address)
        self.sock = self._context.wrap_socket(raw_sock, server_hostname=self._sni_host)


def _validate_google_upload_session_url(session_uri: str) -> tuple[bool, str, dict | None]:
    """Validates YouTube resumable upload Location URI before sending an OAuth Bearer token."""
    if not session_uri or not isinstance(session_uri, str):
        return False, "YouTube API did not return an upload Location session URI.", None
    parsed = urllib.parse.urlparse(session_uri.strip())
    if parsed.scheme.lower() != "https":
        return False, "Rejected non-HTTPS YouTube upload session URI.", None
    if parsed.username or parsed.password:
        return False, "Rejected YouTube upload session URI containing credentials.", None
    try:
        if parsed.port not in (None, 443):
            return False, "Rejected non-standard port on YouTube upload session URI.", None
    except ValueError:
        return False, "Invalid port on YouTube upload session URI.", None

    host = (parsed.hostname or "").lower().rstrip(".")
    if host not in ("www.googleapis.com", "upload.googleapis.com") and not host.endswith(".googleapis.com"):
        return False, f"Rejected untrusted YouTube upload session host '{host}'.", None

    ok, err, resolved = _resolve_and_validate_safe_url(session_uri)
    if not ok:
        return False, f"Rejected unsafe YouTube upload session URI: {err}", None
    return True, "", resolved


def _download_remote_media_safely(
    media_url: str,
    max_bytes: int = 256 * 1024 * 1024,
    max_redirects: int = 5,
    connection_factory=None,
) -> tuple[bool, str | None, str | None]:
    """
    Downloads remote media without automatic redirect following and pins the validated IP
    per hop so redirects and DNS rebinding cannot reach private/loopback/metadata addresses.
    """
    current_url = (media_url or "").strip()
    temp_download_path = None
    try:
        for _ in range(max_redirects + 1):
            ok, err, meta = _resolve_and_validate_safe_url(current_url)
            if not ok or not meta:
                return False, None, err or "Rejected unsafe remote URL."

            if connection_factory is not None:
                conn = connection_factory(meta)
            elif meta["scheme"] == "https":
                conn = _PinnedHTTPSConnection(meta["hostname"], meta["port"], meta["pinned_ip"], timeout=60)
            else:
                conn = _PinnedHTTPConnection(meta["hostname"], meta["port"], meta["pinned_ip"], timeout=60)

            try:
                conn.request(
                    "GET",
                    meta["path_query"],
                    headers={
                        "Host": meta["netloc"],
                        "User-Agent": "SocialSync/2.1",
                        "Accept": "*/*",
                    },
                )
                resp = conn.getresponse()

                if resp.status in (301, 302, 303, 307, 308):
                    location = resp.getheader("Location")
                    resp.read()
                    if not location:
                        return False, None, f"Remote media server returned redirect ({resp.status}) without Location header."
                    current_url = urllib.parse.urljoin(current_url, location.strip())
                    continue

                if resp.status < 200 or resp.status >= 300:
                    resp.read()
                    return False, None, f"Remote media server returned HTTP {resp.status}."

                suffix = os.path.splitext(urllib.parse.urlparse(current_url).path)[1] or ".mp4"
                fd, temp_download_path = tempfile.mkstemp(prefix="ss_yt_", suffix=suffix)
                downloaded = 0
                with os.fdopen(fd, "wb") as tmp_fh:
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        downloaded += len(chunk)
                        if downloaded > max_bytes:
                            raise ValueError("Remote video exceeds 256MB limit.")
                        tmp_fh.write(chunk)
                return True, temp_download_path, None
            finally:
                conn.close()

        return False, None, f"Too many redirects ({max_redirects}) fetching remote media."
    except Exception as exc:
        if temp_download_path and os.path.exists(temp_download_path):
            try:
                os.remove(temp_download_path)
            except OSError:
                pass
        return False, None, redact_secrets(str(exc))


def _http_json(method: str, url: str, headers=None, params=None, form_data=None, json_body=None, timeout=30):
    if params:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{urllib.parse.urlencode(params)}"

    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    body_bytes = None
    if json_body is not None:
        body_bytes = json.dumps(json_body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json; charset=utf-8")
    elif form_data is not None:
        body_bytes = urllib.parse.urlencode(form_data).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")

    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            parsed = json.loads(raw) if raw.strip() else {}
            return True, resp.status, parsed, None
    except urllib.error.HTTPError as exc:
        raw_err = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw_err)
        except Exception:
            parsed = {"raw": raw_err}
        return False, exc.code, parsed, _extract_api_error(raw_err, exc.code)
    except urllib.error.URLError as exc:
        return False, 0, {}, redact_secrets(f"Network error reaching API: {exc.reason}")
    except Exception as exc:
        return False, 0, {}, redact_secrets(f"Unexpected request error: {str(exc)}")


def _http_multipart(url: str, fields: dict, file_field: str, file_path: str, timeout=120, headers=None):
    boundary = f"----SocialSyncBoundary{uuid.uuid4().hex}"
    mime_type, _ = mimetypes.guess_type(file_path)
    mime_type = mime_type or "application/octet-stream"
    filename = os.path.basename(file_path)

    body_parts = []
    for k, v in fields.items():
        if v is None:
            continue
        body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
        body_parts.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body_parts.append(f"{v}\r\n".encode("utf-8"))

    body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
    body_parts.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode("utf-8")
    )
    body_parts.append(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
    with open(file_path, "rb") as fh:
        body_parts.append(fh.read())
    body_parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    payload = b"".join(body_parts)
    req_headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(payload)),
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(
        url,
        data=payload,
        headers=req_headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return True, resp.status, json.loads(raw) if raw.strip() else {}, None
    except urllib.error.HTTPError as exc:
        raw_err = exc.read().decode("utf-8", errors="replace")
        return False, exc.code, {}, _extract_api_error(raw_err, exc.code)
    except Exception as exc:
        return False, 0, {}, redact_secrets(f"Multipart upload error: {str(exc)}")


def _is_localhost_url(url: str | None) -> bool:
    if not url:
        return False
    lower = url.lower()
    return (
        lower.startswith("http://127.0.0.1")
        or lower.startswith("http://localhost")
        or lower.startswith("https://127.0.0.1")
        or lower.startswith("https://localhost")
    )


def resolve_public_media_url(media_url: str | None) -> str | None:
    """Rewrites local /uploads/ URLs to PUBLIC_BASE_URL when configured for Meta cloud fetch."""
    if not media_url:
        return None
    public_base = get_public_base_url()
    if public_base and "/uploads/" in media_url and _is_localhost_url(media_url):
        filename = media_url.split("/uploads/", 1)[1]
        return f"{public_base}/uploads/{filename}"
    return media_url


class SocialPlatformManager:
    def get_capabilities(self, platform_name: str) -> dict:
        return PLATFORM_CAPABILITIES.get(
            platform_name,
            {
                "official_api": False,
                "supported_media": ["text"],
                "supports_text_only": True,
                "requires_public_media_url": False,
                "notes": "Sandbox simulation only.",
            },
        )

    def get_platform_info(self, platform_name: str, oauth_conn: dict | None = None) -> dict:
        cfg = get_oauth_config_status().get(platform_name, {})
        oauth_connected = bool(oauth_conn and oauth_conn.get("connected"))
        caps = self.get_capabilities(platform_name)

        if oauth_connected:
            mode = "live"
            status_message = f"Live OAuth connected ({oauth_conn.get('handle') or oauth_conn.get('account_name') or platform_name})"
        elif caps.get("official_api"):
            mode = "sandbox"
            if cfg.get("configured"):
                status_message = f"[Sandbox Mode] {platform_name} app credentials ready — click 'Connect via OAuth' to authorize your account."
            else:
                missing = ", ".join(cfg.get("missing_env", []))
                status_message = f"[Sandbox Mode] Missing backend credentials ({missing}). Official API not yet authorized."
        else:
            mode = "sandbox"
            status_message = f"[Sandbox Mode] Simulation only ({platform_name} official OAuth publishing is not enabled)."

        return {
            "platform": platform_name,
            "configured": oauth_connected,
            "oauth_configured": bool(cfg.get("configured")),
            "oauth_connected": oauth_connected,
            "missing_env": cfg.get("missing_env", []),
            "mode": mode,
            "capabilities": caps,
            "status_message": status_message,
        }

    # --- OAUTH AUTHORIZATION & TOKEN EXCHANGE ---
    def build_oauth_authorization_url(self, provider: str, state: str, method: str | None = None) -> tuple[bool, dict]:
        redirect_base = get_oauth_redirect_base()
        version = get_meta_version()

        if provider in ("facebook", "instagram"):
            use_ig_login = (
                provider == "instagram"
                and (
                    method == "instagram_login"
                    or (
                        bool(os.environ.get("INSTAGRAM_APP_ID"))
                        and bool(os.environ.get("INSTAGRAM_APP_SECRET"))
                        and not (os.environ.get("META_APP_ID") and os.environ.get("META_APP_SECRET"))
                    )
                )
            )
            if use_ig_login:
                ig_app_id = os.environ.get("INSTAGRAM_APP_ID")
                ig_secret = os.environ.get("INSTAGRAM_APP_SECRET")
                if not ig_app_id or not ig_secret:
                    return False, {
                        "error": "Instagram Login credentials are not configured.",
                        "missing_env": [k for k, v in [("INSTAGRAM_APP_ID", ig_app_id), ("INSTAGRAM_APP_SECRET", ig_secret)] if not v],
                    }
                redirect_uri = f"{redirect_base}/api/oauth/instagram/callback"
                params = {
                    "client_id": ig_app_id,
                    "redirect_uri": redirect_uri,
                    "response_type": "code",
                    "scope": ",".join(INSTAGRAM_LOGIN_SCOPES),
                    "state": state,
                }
                return True, {
                    "auth_url": f"{INSTAGRAM_AUTH_URL}?{urllib.parse.urlencode(params)}",
                    "redirect_uri": redirect_uri,
                    "provider": "instagram_login",
                    "scopes": INSTAGRAM_LOGIN_SCOPES,
                }

            meta_app_id = os.environ.get("META_APP_ID")
            meta_secret = os.environ.get("META_APP_SECRET")
            if not meta_app_id or not meta_secret:
                return False, {
                    "error": f"Meta App credentials are not configured for {provider.title()} OAuth.",
                    "missing_env": [k for k, v in [("META_APP_ID", meta_app_id), ("META_APP_SECRET", meta_secret)] if not v],
                }
            redirect_uri = f"{redirect_base}/api/oauth/{provider}/callback"
            params = {
                "client_id": meta_app_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": ",".join(FACEBOOK_SCOPES),
                "state": state,
            }
            config_id = os.environ.get("META_LOGIN_CONFIG_ID", "").strip()
            if config_id:
                params["config_id"] = config_id
            return True, {
                "auth_url": f"https://www.facebook.com/{version}/dialog/oauth?{urllib.parse.urlencode(params)}",
                "redirect_uri": redirect_uri,
                "provider": "meta",
                "scopes": FACEBOOK_SCOPES,
            }

        if provider == "youtube":
            client_id = os.environ.get("GOOGLE_CLIENT_ID")
            client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
            if not client_id or not client_secret:
                return False, {
                    "error": "Google OAuth credentials are not configured for YouTube.",
                    "missing_env": [k for k, v in [("GOOGLE_CLIENT_ID", client_id), ("GOOGLE_CLIENT_SECRET", client_secret)] if not v],
                }
            redirect_uri = f"{redirect_base}/api/oauth/youtube/callback"
            params = {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": " ".join(YOUTUBE_SCOPES),
                "access_type": "offline",
                "prompt": "consent",
                "include_granted_scopes": "true",
                "state": state,
            }
            return True, {
                "auth_url": f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}",
                "redirect_uri": redirect_uri,
                "provider": "google",
                "scopes": YOUTUBE_SCOPES,
            }

        return False, {"error": f"Unsupported OAuth provider '{provider}'."}

    def exchange_meta_code(self, provider: str, code: str) -> tuple[bool, dict]:
        version = get_meta_version()
        redirect_uri = f"{get_oauth_redirect_base()}/api/oauth/{provider}/callback"
        app_id = os.environ.get("META_APP_ID")
        app_secret = os.environ.get("META_APP_SECRET")
        if not app_id or not app_secret:
            return False, {"error": "Missing META_APP_ID or META_APP_SECRET on server."}

        ok, _, token_data, err = _http_json(
            "POST",
            f"https://graph.facebook.com/{version}/oauth/access_token",
            form_data={
                "client_id": app_id,
                "redirect_uri": redirect_uri,
                "client_secret": app_secret,
                "code": code,
            },
        )
        if not ok:
            return False, {"error": f"Meta token exchange failed: {err}"}

        short_token = token_data.get("access_token")
        if not short_token:
            return False, {"error": "Meta OAuth did not return an access_token."}

        # Upgrade to 60-day long-lived user token via POST body (never expose secret/token in URL query)
        long_token = short_token
        expires_in = token_data.get("expires_in", 3600)
        ok_ll, _, ll_data, _ = _http_json(
            "POST",
            f"https://graph.facebook.com/{version}/oauth/access_token",
            form_data={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": short_token,
            },
        )
        if ok_ll and ll_data.get("access_token"):
            long_token = ll_data["access_token"]
            expires_in = ll_data.get("expires_in", 60 * 86400)

        # Fetch managed Facebook Pages & linked Instagram Professional Accounts
        ok_pages, _, pages_data, pages_err = _http_json(
            "GET",
            f"https://graph.facebook.com/{version}/me/accounts",
            headers={"Authorization": f"Bearer {long_token}"},
            params={
                "fields": "id,name,username,access_token,followers_count,fan_count,picture{url},instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}",
            },
        )
        if not ok_pages:
            return False, {"error": f"Failed to fetch managed Facebook Pages (/me/accounts): {pages_err}"}

        pages = pages_data.get("data", [])
        if not pages:
            return False, {
                "error": "No Facebook Pages found for this account. Ensure you manage at least one Facebook Page and granted pages_show_list."
            }

        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in or 5184000))).strftime("%Y-%m-%d %H:%M:%S")
        return True, {
            "provider": "meta",
            "user_access_token": long_token,
            "expires_at": expires_at,
            "pages": pages,
            "scopes": FACEBOOK_SCOPES,
        }

    def exchange_instagram_login_code(self, code: str) -> tuple[bool, dict]:
        redirect_uri = f"{get_oauth_redirect_base()}/api/oauth/instagram/callback"
        ig_id = os.environ.get("INSTAGRAM_APP_ID")
        ig_secret = os.environ.get("INSTAGRAM_APP_SECRET")
        if not ig_id or not ig_secret:
            return False, {"error": "Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET on server."}

        ok, _, token_data, err = _http_json(
            "POST",
            INSTAGRAM_TOKEN_URL,
            form_data={
                "client_id": ig_id,
                "client_secret": ig_secret,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        if not ok:
            return False, {"error": f"Instagram Login token exchange failed: {err}"}

        short_token = token_data.get("access_token")
        if not short_token:
            return False, {"error": "Instagram Login did not return an access_token."}

        long_token = short_token
        expires_in = 3600
        ok_ll, _, ll_data, _ = _http_json(
            "GET",
            f"{INSTAGRAM_GRAPH_BASE}/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": ig_secret,
                "access_token": short_token,
            },
        )
        if ok_ll and ll_data.get("access_token"):
            long_token = ll_data["access_token"]
            expires_in = ll_data.get("expires_in", 5184000)

        ok_me, _, me_data, me_err = _http_json(
            "GET",
            f"{INSTAGRAM_GRAPH_BASE}/me",
            headers={"Authorization": f"Bearer {long_token}"},
            params={
                "fields": "id,user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
            },
        )
        if not ok_me:
            return False, {"error": f"Failed to fetch Instagram profile: {me_err}"}

        ig_user_id = str(me_data.get("user_id") or me_data.get("id") or "")
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in or 5184000))).strftime("%Y-%m-%d %H:%M:%S")
        return True, {
            "provider": "instagram_login",
            "access_token": long_token,
            "expires_at": expires_at,
            "profile": {
                "id": ig_user_id,
                "username": me_data.get("username", ""),
                "name": me_data.get("name") or me_data.get("username") or "Instagram Account",
                "profile_picture_url": me_data.get("profile_picture_url"),
                "followers_count": int(me_data.get("followers_count") or 0),
                "follows_count": int(me_data.get("follows_count") or 0),
                "media_count": int(me_data.get("media_count") or 0),
            },
            "scopes": INSTAGRAM_LOGIN_SCOPES,
        }

    def exchange_youtube_code(self, code: str) -> tuple[bool, dict]:
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
        redirect_uri = f"{get_oauth_redirect_base()}/api/oauth/youtube/callback"
        if not client_id or not client_secret:
            return False, {"error": "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET on server."}

        ok, _, token_data, err = _http_json(
            "POST",
            GOOGLE_TOKEN_URL,
            form_data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if not ok:
            return False, {"error": f"Google OAuth token exchange failed: {err}"}

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = int(token_data.get("expires_in") or 3600)
        if not access_token:
            return False, {"error": "Google OAuth did not return an access_token."}

        ok_ch, _, ch_data, ch_err = _http_json(
            "GET",
            YOUTUBE_CHANNELS_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            params={"part": "snippet,statistics", "mine": "true"},
        )
        if not ok_ch:
            return False, {"error": f"Failed to fetch YouTube channel info: {ch_err}"}

        items = ch_data.get("items", [])
        if not items:
            return False, {"error": "No YouTube channel found on this Google account."}

        ch = items[0]
        snippet = ch.get("snippet", {})
        stats = ch.get("statistics", {})
        thumbs = snippet.get("thumbnails", {})
        avatar = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).strftime("%Y-%m-%d %H:%M:%S")

        return True, {
            "provider": "google",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "scopes": (token_data.get("scope") or "").split() or YOUTUBE_SCOPES,
            "channel": {
                "id": ch.get("id"),
                "title": snippet.get("title", "YouTube Channel"),
                "handle": snippet.get("customUrl") or f"@{snippet.get('title', 'channel').replace(' ', '')}",
                "avatar": avatar,
                "subscribers": int(stats.get("subscriberCount") or 0),
                "views": int(stats.get("viewCount") or 0),
                "videos": int(stats.get("videoCount") or 0),
            },
        }

    def refresh_google_access_token(self, refresh_token: str) -> tuple[bool, dict]:
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
        if not client_id or not client_secret:
            return False, {"error": "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET to refresh token."}
        if not refresh_token:
            return False, {"error": "No refresh_token stored for YouTube. Please reconnect via OAuth.", "needs_reauth": True}

        ok, code, data, err = _http_json(
            "POST",
            GOOGLE_TOKEN_URL,
            form_data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        if not ok or not data.get("access_token"):
            reauth = _is_auth_revoked_error(code, data, err)
            return False, {
                "error": f"Failed to refresh YouTube OAuth token: {err or 'No access_token returned'}",
                "needs_reauth": reauth,
            }

        expires_in = int(data.get("expires_in") or 3600)
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).strftime("%Y-%m-%d %H:%M:%S")
        return True, {
            "access_token": data["access_token"],
            "expires_at": expires_at,
            "refresh_token": data.get("refresh_token"),
        }

    def refresh_instagram_login_token(self, access_token: str) -> tuple[bool, dict]:
        if not access_token:
            return False, {"error": "Missing Instagram access token."}
        ok, code, data, err = _http_json(
            "GET",
            f"{INSTAGRAM_GRAPH_BASE}/refresh_access_token",
            params={
                "grant_type": "ig_refresh_token",
                "access_token": access_token,
            },
        )
        if not ok or not data.get("access_token"):
            return False, {
                "error": f"Instagram token refresh failed: {err or 'No token returned'}",
                "needs_reauth": _is_auth_revoked_error(code, data, err),
            }
        expires_in = int(data.get("expires_in") or 5184000)
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).strftime("%Y-%m-%d %H:%M:%S")
        return True, {"access_token": data["access_token"], "expires_at": expires_at}

    @staticmethod
    def is_token_expired(expires_at: str | None, buffer_seconds: int = 0) -> bool:
        if not expires_at:
            return False
        try:
            exp_dt = datetime.strptime(str(expires_at)[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            return exp_dt <= datetime.now(timezone.utc) + timedelta(seconds=buffer_seconds)
        except ValueError:
            return False

    def revoke_oauth_connection(
        self,
        provider: str,
        access_token: str | None,
        refresh_token: str | None = None,
        user_access_token: str | None = None,
        permission_name: str | None = None,
    ) -> tuple[bool, str]:
        """Best-effort upstream token/permission revocation on provider side during Disconnect."""
        version = get_meta_version()
        if provider == "google":
            tok = refresh_token or access_token
            if not tok:
                return True, "No active Google token to revoke."
            ok, _, _, err = _http_json(
                "POST",
                "https://oauth2.googleapis.com/revoke",
                form_data={"token": tok},
                timeout=15,
            )
            return (True, "Revoked Google OAuth token.") if ok else (False, f"Upstream Google revocation warning: {err}")

        if provider == "meta":
            # Meta permissions must be revoked with a User Access Token, never a Page token
            meta_user_tok = user_access_token or access_token
            if not meta_user_tok:
                return True, "Local Meta OAuth credentials wiped."
            if permission_name:
                target = f"https://graph.facebook.com/{version}/me/permissions/{urllib.parse.quote(permission_name, safe='')}"
                label = f"permission '{permission_name}'"
            else:
                target = f"https://graph.facebook.com/{version}/me/permissions"
                label = "Meta Graph permissions"
            ok, _, _, err = _http_json(
                "DELETE",
                target,
                headers={"Authorization": f"Bearer {meta_user_tok}"},
                timeout=15,
            )
            return (True, f"Revoked {label}.") if ok else (False, f"Upstream Meta revocation warning ({label}): {err}")

        if provider == "instagram_login":
            return True, "Local Instagram Login OAuth credentials wiped."

        return True, "Local OAuth credentials wiped."

    # --- LIVE PUBLISHING (OFFICIAL APIS ONLY) ---
    def publish_live_facebook(
        self,
        page_id: str,
        page_access_token: str,
        content: str,
        media_url: str | None = None,
        media_type: str = "text",
        local_file_path: str | None = None,
        video_title: str | None = None,
        expires_at: str | None = None,
    ) -> dict:
        version = get_meta_version()
        if not page_id or not page_access_token:
            return {
                "success": False,
                "mode": "live",
                "platform": "Facebook",
                "error": "Facebook Page is not authorized via OAuth.",
                "needs_reauth": True,
            }

        if self.is_token_expired(expires_at):
            return {
                "success": False,
                "mode": "live",
                "platform": "Facebook",
                "error": "Facebook OAuth session has expired. Please reconnect Facebook via OAuth.",
                "needs_reauth": True,
            }

        auth_hdr = {"Authorization": f"Bearer {page_access_token}"}
        if media_type == "video" and (local_file_path or media_url):
            video_endpoint = f"https://graph-video.facebook.com/{version}/{page_id}/videos"
            if local_file_path and os.path.isfile(local_file_path):
                ok, code, data, err = _http_multipart(
                    video_endpoint,
                    headers=auth_hdr,
                    fields={
                        "title": video_title or content[:80],
                        "description": content,
                    },
                    file_field="source",
                    file_path=local_file_path,
                )
            else:
                ok, code, data, err = _http_json(
                    "POST",
                    video_endpoint,
                    headers=auth_hdr,
                    form_data={
                        "file_url": media_url,
                        "title": video_title or content[:80],
                        "description": content,
                    },
                )
        elif media_type == "image" and (local_file_path or media_url):
            photo_endpoint = f"https://graph.facebook.com/{version}/{page_id}/photos"
            if local_file_path and os.path.isfile(local_file_path):
                ok, code, data, err = _http_multipart(
                    photo_endpoint,
                    headers=auth_hdr,
                    fields={
                        "caption": content,
                        "published": "true",
                    },
                    file_field="source",
                    file_path=local_file_path,
                )
            else:
                ok, code, data, err = _http_json(
                    "POST",
                    photo_endpoint,
                    headers=auth_hdr,
                    form_data={
                        "url": media_url,
                        "caption": content,
                        "published": "true",
                    },
                )
        else:
            ok, code, data, err = _http_json(
                "POST",
                f"https://graph.facebook.com/{version}/{page_id}/feed",
                headers=auth_hdr,
                form_data={"message": content},
            )

        if not ok:
            return {
                "success": False,
                "mode": "live",
                "platform": "Facebook",
                "error": err or "Facebook Graph API rejected the post.",
                "needs_reauth": _is_auth_revoked_error(code, data, err),
            }

        post_id = str(data.get("post_id") or data.get("id") or "")
        permalink = f"https://www.facebook.com/{post_id}" if post_id else None
        return {
            "success": True,
            "mode": "live",
            "platform": "Facebook",
            "external_post_id": post_id,
            "permalink": permalink,
            "published_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "message": f"Published to Facebook Page ({page_id}).",
        }

    def publish_live_instagram(
        self,
        ig_user_id: str,
        access_token: str,
        provider: str,
        content: str,
        media_url: str | None = None,
        media_type: str = "image",
        expires_at: str | None = None,
        token_refresh_cb=None,
    ) -> dict:
        if not ig_user_id or not access_token:
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": "Instagram Professional account is not authorized via OAuth.",
                "needs_reauth": True,
            }

        if self.is_token_expired(expires_at):
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": "Instagram OAuth token has expired. Please reconnect Instagram via OAuth.",
                "needs_reauth": True,
            }

        active_token = access_token
        if provider == "instagram_login" and self.is_token_expired(expires_at, buffer_seconds=7 * 86400):
            ok_ref, ref_res = self.refresh_instagram_login_token(active_token)
            if ok_ref:
                active_token = ref_res["access_token"]
                if token_refresh_cb:
                    token_refresh_cb(active_token, ref_res["expires_at"])
            elif ref_res.get("needs_reauth"):
                return {
                    "success": False,
                    "mode": "live",
                    "platform": "Instagram",
                    "error": ref_res.get("error", "Instagram OAuth token refresh failed. Please reconnect Instagram."),
                    "needs_reauth": True,
                }

        if media_type == "text" or not media_url:
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": "Instagram Graph API does not support text-only posts. Please attach a public image or video URL.",
            }

        public_media = resolve_public_media_url(media_url)
        if _is_localhost_url(public_media) or (public_media or "").startswith("data:"):
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": (
                    "Instagram Graph API requires a publicly reachable HTTPS media URL. "
                    "Localhost uploads (/uploads/...) cannot be fetched by Meta unless PUBLIC_BASE_URL (e.g. an ngrok HTTPS tunnel) is configured in backend/.env."
                ),
            }

        base_url = INSTAGRAM_GRAPH_BASE if provider == "instagram_login" else f"https://graph.facebook.com/{get_meta_version()}"
        auth_hdr = {"Authorization": f"Bearer {active_token}"}
        form_payload = {"caption": content}
        if media_type == "video":
            form_payload["media_type"] = "REELS"
            form_payload["video_url"] = public_media
            form_payload["share_to_feed"] = "true"
        else:
            form_payload["image_url"] = public_media

        # Step 1: Create container
        ok_c, code_c, c_data, c_err = _http_json(
            "POST",
            f"{base_url}/{ig_user_id}/media",
            headers=auth_hdr,
            form_data=form_payload,
            timeout=45,
        )
        if not ok_c or not c_data.get("id"):
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": f"Instagram container creation failed: {c_err or 'No container id returned'}",
                "needs_reauth": _is_auth_revoked_error(code_c, c_data, c_err),
            }
        creation_id = c_data["id"]

        # Step 2: Poll container status (critical for Reels/Videos, safe quick check for Images)
        max_attempts = 18 if media_type == "video" else 4
        poll_delay = 3 if media_type == "video" else 1
        container_ready = False
        last_status = "IN_PROGRESS"
        for _ in range(max_attempts):
            ok_s, _, s_data, s_err = _http_json(
                "GET",
                f"{base_url}/{creation_id}",
                headers=auth_hdr,
                params={"fields": "status_code,status"},
            )
            if ok_s:
                last_status = (s_data.get("status_code") or "").upper()
                if last_status == "FINISHED":
                    container_ready = True
                    break
                if last_status in ("ERROR", "EXPIRED"):
                    return {
                        "success": False,
                        "mode": "live",
                        "platform": "Instagram",
                        "error": f"Instagram media processing failed ({last_status}): {s_data.get('status') or s_err or 'Check media format/URL accessibility.'}",
                    }
            time.sleep(poll_delay)

        if not container_ready and media_type == "video":
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": f"Instagram video processing timed out (last status: {last_status}). Container ID: {creation_id}",
            }

        # Step 3: Publish container
        ok_pub, code_pub, pub_data, pub_err = _http_json(
            "POST",
            f"{base_url}/{ig_user_id}/media_publish",
            headers=auth_hdr,
            form_data={"creation_id": creation_id},
            timeout=45,
        )
        if not ok_pub or not pub_data.get("id"):
            return {
                "success": False,
                "mode": "live",
                "platform": "Instagram",
                "error": f"Instagram media_publish failed: {pub_err or 'No media id returned'}",
                "needs_reauth": _is_auth_revoked_error(code_pub, pub_data, pub_err),
            }

        media_id = str(pub_data["id"])
        permalink = None
        ok_link, _, link_data, _ = _http_json(
            "GET",
            f"{base_url}/{media_id}",
            headers=auth_hdr,
            params={"fields": "permalink"},
        )
        if ok_link:
            permalink = link_data.get("permalink")

        return {
            "success": True,
            "mode": "live",
            "platform": "Instagram",
            "external_post_id": media_id,
            "permalink": permalink,
            "published_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "message": f"Published to Instagram ({ig_user_id}).",
        }

    def publish_live_youtube(
        self,
        access_token: str,
        refresh_token: str | None,
        expires_at: str | None,
        content: str,
        media_url: str | None = None,
        media_type: str = "text",
        local_file_path: str | None = None,
        video_title: str | None = None,
        privacy_status: str = "private",
        token_refresh_cb=None,
    ) -> dict:
        if media_type != "video" or (not local_file_path and not media_url):
            return {
                "success": False,
                "mode": "live",
                "platform": "YouTube",
                "error": "YouTube Data API v3 only supports video uploads. Please attach a video file or video URL.",
            }

        # Auto-refresh Google access token if expired or within 2 minutes of expiry
        active_token = access_token
        needs_refresh = self.is_token_expired(expires_at, buffer_seconds=120)
        if needs_refresh:
            if not refresh_token:
                return {
                    "success": False,
                    "mode": "live",
                    "platform": "YouTube",
                    "error": "YouTube OAuth token expired and no refresh_token is stored. Please reconnect YouTube via OAuth.",
                    "needs_reauth": True,
                }
            ok_ref, ref_res = self.refresh_google_access_token(refresh_token)
            if not ok_ref:
                return {
                    "success": False,
                    "mode": "live",
                    "platform": "YouTube",
                    "error": ref_res.get("error", "YouTube token expired and refresh failed."),
                    "needs_reauth": bool(ref_res.get("needs_reauth", True)),
                }
            active_token = ref_res["access_token"]
            if token_refresh_cb:
                token_refresh_cb(active_token, ref_res["expires_at"], ref_res.get("refresh_token"))

        if not active_token:
            return {
                "success": False,
                "mode": "live",
                "platform": "YouTube",
                "error": "YouTube account is not authorized via OAuth.",
                "needs_reauth": True,
            }

        temp_download_path = None
        upload_path = local_file_path if (local_file_path and os.path.isfile(local_file_path)) else None
        try:
            if not upload_path:
                dl_ok, downloaded_path, dl_err = _download_remote_media_safely(media_url or "")
                if not dl_ok or not downloaded_path:
                    return {
                        "success": False,
                        "mode": "live",
                        "platform": "YouTube",
                        "error": redact_secrets(f"Rejected or failed remote video download: {dl_err}"),
                    }
                temp_download_path = downloaded_path
                upload_path = temp_download_path

            file_size = os.path.getsize(upload_path)
            mime_type, _ = mimetypes.guess_type(upload_path)
            if not mime_type or not mime_type.startswith("video/"):
                mime_type = "video/mp4"

            safe_privacy = privacy_status if privacy_status in ("private", "unlisted", "public") else "private"
            title = (video_title or "").strip() or (content.splitlines()[0][:95] if content else "SocialSync Video")

            metadata = {
                "snippet": {
                    "title": title[:100],
                    "description": content,
                    "categoryId": "22",
                },
                "status": {
                    "privacyStatus": safe_privacy,
                    "selfDeclaredMadeForKids": False,
                },
            }

            init_url = f"{YOUTUBE_UPLOAD_INIT_URL}?uploadType=resumable&part=snippet,status"
            init_body = json.dumps(metadata).encode("utf-8")

            raw_put = ""
            for attempt in range(2):
                # Step 1: Initialize YouTube resumable upload session
                init_req = urllib.request.Request(
                    init_url,
                    data=init_body,
                    method="POST",
                    headers={
                        "Authorization": f"Bearer {active_token}",
                        "Content-Type": "application/json; charset=UTF-8",
                        "X-Upload-Content-Length": str(file_size),
                        "X-Upload-Content-Type": mime_type,
                    },
                )
                try:
                    with urllib.request.urlopen(init_req, timeout=30) as init_resp:
                        session_uri = init_resp.headers.get("Location")
                except urllib.error.HTTPError as exc:
                    raw_err = exc.read().decode("utf-8", errors="replace")
                    if exc.code == 401 and attempt == 0 and refresh_token:
                        ok_ref, ref_res = self.refresh_google_access_token(refresh_token)
                        if ok_ref:
                            active_token = ref_res["access_token"]
                            if token_refresh_cb:
                                token_refresh_cb(active_token, ref_res["expires_at"], ref_res.get("refresh_token"))
                            continue
                        return {
                            "success": False,
                            "mode": "live",
                            "platform": "YouTube",
                            "error": ref_res.get("error", "YouTube token refresh failed."),
                            "needs_reauth": bool(ref_res.get("needs_reauth", True)),
                        }
                    try:
                        parsed_err = json.loads(raw_err)
                    except Exception:
                        parsed_err = None
                    err_msg = _extract_api_error(raw_err, exc.code)
                    return {
                        "success": False,
                        "mode": "live",
                        "platform": "YouTube",
                        "error": f"YouTube resumable upload init failed: {err_msg}",
                        "needs_reauth": _is_auth_revoked_error(exc.code, parsed_err, err_msg),
                    }

                sess_ok, sess_err, sess_meta = _validate_google_upload_session_url(session_uri or "")
                if not sess_ok or not sess_meta:
                    return {
                        "success": False,
                        "mode": "live",
                        "platform": "YouTube",
                        "error": sess_err or "Invalid YouTube upload Location session URI.",
                    }

                # Step 2: PUT binary video bytes to validated Google session URI (IP pinned)
                conn = _PinnedHTTPSConnection(
                    sess_meta["hostname"],
                    sess_meta["port"],
                    sess_meta["pinned_ip"],
                    timeout=300,
                )
                try:
                    with open(upload_path, "rb") as vf:
                        conn.putrequest("PUT", sess_meta["path_query"])
                        conn.putheader("Host", sess_meta["netloc"])
                        conn.putheader("Authorization", f"Bearer {active_token}")
                        conn.putheader("Content-Length", str(file_size))
                        conn.putheader("Content-Type", mime_type)
                        conn.endheaders()
                        while True:
                            chunk = vf.read(1024 * 1024)
                            if not chunk:
                                break
                            conn.send(chunk)

                    put_resp = conn.getresponse()
                    raw_put = put_resp.read().decode("utf-8", errors="replace")
                finally:
                    conn.close()

                if put_resp.status == 401 and attempt == 0 and refresh_token:
                    ok_ref, ref_res = self.refresh_google_access_token(refresh_token)
                    if ok_ref:
                        active_token = ref_res["access_token"]
                        if token_refresh_cb:
                            token_refresh_cb(active_token, ref_res["expires_at"], ref_res.get("refresh_token"))
                        continue
                    return {
                        "success": False,
                        "mode": "live",
                        "platform": "YouTube",
                        "error": ref_res.get("error", "YouTube token refresh failed during upload."),
                        "needs_reauth": bool(ref_res.get("needs_reauth", True)),
                    }

                if put_resp.status not in (200, 201):
                    try:
                        parsed_put = json.loads(raw_put)
                    except Exception:
                        parsed_put = None
                    err_msg = _extract_api_error(raw_put, put_resp.status)
                    return {
                        "success": False,
                        "mode": "live",
                        "platform": "YouTube",
                        "error": f"YouTube video binary upload failed: {err_msg}",
                        "needs_reauth": _is_auth_revoked_error(put_resp.status, parsed_put, err_msg),
                    }
                break

            vid_json = json.loads(raw_put) if raw_put.strip() else {}
            video_id = str(vid_json.get("id") or "")
            return {
                "success": True,
                "mode": "live",
                "platform": "YouTube",
                "external_post_id": video_id,
                "permalink": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
                "privacy_status": vid_json.get("status", {}).get("privacyStatus", safe_privacy),
                "published_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "message": f"Uploaded video to YouTube ({safe_privacy}).",
            }
        finally:
            if temp_download_path and os.path.exists(temp_download_path):
                try:
                    os.remove(temp_download_path)
                except OSError:
                    pass

    # --- LIVE ACCOUNT SYNC & ANALYTICS ---
    def sync_live_account(self, oauth_conn: dict, access_token: str, refresh_token: str | None = None, token_refresh_cb=None) -> dict:
        platform = oauth_conn["platform"]
        ext_id = oauth_conn["external_account_id"]
        provider = oauth_conn["provider"]
        expires_at = oauth_conn.get("expires_at")
        version = get_meta_version()

        if platform == "Facebook":
            if self.is_token_expired(expires_at):
                return {"success": False, "platform": "Facebook", "error": "Facebook OAuth token has expired. Please reconnect Facebook via OAuth.", "needs_reauth": True}

            auth_hdr = {"Authorization": f"Bearer {access_token}"}
            ok, code, data, err = _http_json(
                "GET",
                f"https://graph.facebook.com/{version}/{ext_id}",
                headers=auth_hdr,
                params={"fields": "id,name,username,followers_count,fan_count,picture{url}"},
            )
            if not ok:
                return {"success": False, "platform": "Facebook", "error": f"Facebook Page sync failed: {err}", "needs_reauth": _is_auth_revoked_error(code, data, err)}

            followers = int(data.get("followers_count") or data.get("fan_count") or 0)
            avatar = data.get("picture", {}).get("data", {}).get("url")
            name = data.get("name") or oauth_conn.get("account_name")
            handle = f"@{data['username']}" if data.get("username") else (oauth_conn.get("handle") or name)

            # Insights (requires read_insights permission)
            views = 0
            engagement = 0
            permission_note = None
            ok_ins, _, ins_data, ins_err = _http_json(
                "GET",
                f"https://graph.facebook.com/{version}/{ext_id}/insights",
                headers=auth_hdr,
                params={
                    "metric": "page_total_media_view_unique,page_post_engagements",
                    "period": "day",
                },
            )
            if ok_ins:
                for metric_item in ins_data.get("data", []):
                    vals = metric_item.get("values", [])
                    latest_val = vals[-1].get("value", 0) if vals else 0
                    if isinstance(latest_val, (int, float)):
                        if metric_item.get("name") == "page_total_media_view_unique":
                            views = int(latest_val)
                        elif metric_item.get("name") == "page_post_engagements":
                            engagement = int(latest_val)
            else:
                permission_note = f"Page insights unavailable ({ins_err}). Basic Page followers synced."

            return {
                "success": True,
                "mode": "live",
                "platform": "Facebook",
                "external_account_id": ext_id,
                "name": name,
                "handle": handle,
                "avatar": avatar,
                "followers": followers,
                "views": views,
                "reach": views,
                "engagement": engagement,
                "growth": "Live",
                "permission_note": permission_note,
                "last_synced": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

        if platform == "Instagram":
            if self.is_token_expired(expires_at):
                return {"success": False, "platform": "Instagram", "error": "Instagram OAuth token has expired. Please reconnect Instagram via OAuth.", "needs_reauth": True}

            active_token = access_token
            if provider == "instagram_login" and self.is_token_expired(expires_at, buffer_seconds=7 * 86400):
                ok_ref, ref_res = self.refresh_instagram_login_token(active_token)
                if ok_ref:
                    active_token = ref_res["access_token"]
                    if token_refresh_cb:
                        token_refresh_cb(active_token, ref_res["expires_at"])
                elif ref_res.get("needs_reauth"):
                    return {
                        "success": False,
                        "platform": "Instagram",
                        "error": ref_res.get("error", "Instagram OAuth token refresh failed. Please reconnect Instagram."),
                        "needs_reauth": True,
                    }

            base_url = INSTAGRAM_GRAPH_BASE if provider == "instagram_login" else f"https://graph.facebook.com/{version}"
            target_node = "me" if provider == "instagram_login" else ext_id
            auth_hdr = {"Authorization": f"Bearer {active_token}"}
            ok, code, data, err = _http_json(
                "GET",
                f"{base_url}/{target_node}",
                headers=auth_hdr,
                params={"fields": "id,username,name,profile_picture_url,followers_count,follows_count,media_count"},
            )
            if not ok:
                return {"success": False, "platform": "Instagram", "error": f"Instagram profile sync failed: {err}", "needs_reauth": _is_auth_revoked_error(code, data, err)}

            followers = int(data.get("followers_count") or 0)
            following = int(data.get("follows_count") or 0)
            media_count = int(data.get("media_count") or 0)
            username = data.get("username") or ""
            handle = f"@{username}" if username else (oauth_conn.get("handle") or "instagram")
            name = data.get("name") or username or "Instagram Account"
            avatar = data.get("profile_picture_url")

            reach = 0
            profile_views = 0
            permission_note = None
            ok_ins, _, ins_data, ins_err = _http_json(
                "GET",
                f"{base_url}/{ext_id}/insights",
                headers=auth_hdr,
                params={
                    "metric": "reach,profile_views",
                    "period": "day",
                },
            )
            if ok_ins:
                for metric_item in ins_data.get("data", []):
                    vals = metric_item.get("values", [])
                    latest_val = vals[-1].get("value", 0) if vals else 0
                    if isinstance(latest_val, (int, float)):
                        if metric_item.get("name") == "reach":
                            reach = int(latest_val)
                        elif metric_item.get("name") == "profile_views":
                            profile_views = int(latest_val)
            else:
                permission_note = (
                    f"Instagram insights unavailable ({ins_err}). "
                    "Note: Meta requires instagram_manage_insights permission and 100+ followers for some insights."
                )

            return {
                "success": True,
                "mode": "live",
                "platform": "Instagram",
                "external_account_id": ext_id,
                "name": name,
                "handle": handle,
                "avatar": avatar,
                "followers": followers,
                "following": following,
                "media_count": media_count,
                "views": profile_views,
                "reach": reach,
                "growth": "Live",
                "permission_note": permission_note,
                "last_synced": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

        if platform == "YouTube":
            active_token = access_token
            if self.is_token_expired(expires_at, buffer_seconds=120):
                if not refresh_token:
                    return {"success": False, "platform": "YouTube", "error": "YouTube OAuth token expired and no refresh_token is stored. Please reconnect YouTube.", "needs_reauth": True}
                ok_ref, ref_res = self.refresh_google_access_token(refresh_token)
                if not ok_ref:
                    return {
                        "success": False,
                        "platform": "YouTube",
                        "error": ref_res.get("error", "YouTube token refresh failed."),
                        "needs_reauth": bool(ref_res.get("needs_reauth", True)),
                    }
                active_token = ref_res["access_token"]
                if token_refresh_cb:
                    token_refresh_cb(active_token, ref_res["expires_at"], ref_res.get("refresh_token"))

            ok_ch, code_ch, ch_data, ch_err = _http_json(
                "GET",
                YOUTUBE_CHANNELS_URL,
                headers={"Authorization": f"Bearer {active_token}"},
                params={"part": "snippet,statistics", "mine": "true"},
            )
            if not ok_ch and code_ch == 401 and refresh_token:
                # Reactive refresh once on HTTP 401 (e.g. clock skew or premature token expiry)
                ok_ref, ref_res = self.refresh_google_access_token(refresh_token)
                if ok_ref:
                    active_token = ref_res["access_token"]
                    if token_refresh_cb:
                        token_refresh_cb(active_token, ref_res["expires_at"], ref_res.get("refresh_token"))
                    ok_ch, code_ch, ch_data, ch_err = _http_json(
                        "GET",
                        YOUTUBE_CHANNELS_URL,
                        headers={"Authorization": f"Bearer {active_token}"},
                        params={"part": "snippet,statistics", "mine": "true"},
                    )
            if not ok_ch:
                return {"success": False, "platform": "YouTube", "error": f"YouTube channel sync failed: {ch_err}", "needs_reauth": _is_auth_revoked_error(code_ch, ch_data, ch_err)}

            items = ch_data.get("items", [])
            if not items:
                return {"success": False, "platform": "YouTube", "error": "No YouTube channel found on authorized account."}

            ch = items[0]
            snippet = ch.get("snippet", {})
            stats = ch.get("statistics", {})
            thumbs = snippet.get("thumbnails", {})
            avatar = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
            subscribers = int(stats.get("subscriberCount") or 0)
            total_views = int(stats.get("viewCount") or 0)
            video_count = int(stats.get("videoCount") or 0)

            recent_engagement = 0
            recent_views = total_views
            permission_note = None
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
            ok_an, _, an_data, an_err = _http_json(
                "GET",
                YOUTUBE_ANALYTICS_URL,
                headers={"Authorization": f"Bearer {active_token}"},
                params={
                    "ids": "channel==MINE",
                    "startDate": start_date,
                    "endDate": end_date,
                    "metrics": "views,likes,comments,shares",
                },
            )
            if ok_an and an_data.get("rows"):
                row = an_data["rows"][0]
                recent_views = int(row[0] or 0)
                recent_engagement = int((row[1] or 0) + (row[2] or 0) + (row[3] or 0))
            elif not ok_an:
                permission_note = f"YouTube Analytics API 30-day breakdown unavailable ({an_err}). Channel totals synced."

            return {
                "success": True,
                "mode": "live",
                "platform": "YouTube",
                "external_account_id": str(ch.get("id") or ext_id),
                "name": snippet.get("title") or oauth_conn.get("account_name"),
                "handle": snippet.get("customUrl") or oauth_conn.get("handle"),
                "avatar": avatar,
                "followers": subscribers,
                "views": recent_views,
                "reach": total_views,
                "engagement": recent_engagement,
                "video_count": video_count,
                "growth": "Live",
                "permission_note": permission_note,
                "last_synced": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

        return {"success": False, "platform": platform, "error": f"Live API sync is not implemented for {platform}."}

    # --- SANDBOX MODE SIMULATION (STRICTLY SEPARATE FROM LIVE MODE) ---
    def simulate_sandbox_publish(self, platform_name: str) -> dict:
        timestamp = int(time.time())
        base_reach = {
            "Instagram": (1200, 3400),
            "TikTok": (2500, 8500),
            "Facebook": (800, 2200),
            "X": (900, 2800),
            "LinkedIn": (600, 1800),
            "YouTube": (1500, 4500),
        }.get(platform_name, (500, 2000))

        est_reach = random.randint(*base_reach)
        est_likes = int(est_reach * random.uniform(0.04, 0.08))
        est_comments = int(est_likes * random.uniform(0.05, 0.15))
        est_shares = int(est_likes * random.uniform(0.02, 0.08))

        return {
            "success": True,
            "simulated": True,
            "mode": "sandbox",
            "platform": platform_name,
            "external_post_id": f"sandbox_{platform_name.lower()}_{timestamp}",
            "permalink": None,
            "published_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "message": f"[Sandbox Simulation] Simulated post recorded for {platform_name}. Not published to any live social network.",
            "initial_performance": {
                "reach": est_reach,
                "likes": est_likes,
                "comments": est_comments,
                "shares": est_shares,
            },
        }

    def simulate_sandbox_metrics(self, current_followers: int = 0) -> dict:
        growth_pct = round(random.uniform(0.1, 0.6), 1)
        follower_delta = int(current_followers * (growth_pct / 100))
        return {
            "mode": "sandbox",
            "simulated": True,
            "followers": current_followers + follower_delta,
            "growth": f"+{growth_pct}%",
            "last_synced": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }


social_manager = SocialPlatformManager()
