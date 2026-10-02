import base64
import logging
from html import escape

import resend

from app.core.config import get_settings
from app.core.timeutil import local_now

log = logging.getLogger("mailer")


def smtp_configured() -> bool:
    """Returns True if Resend API key is configured (kept name for backward compat)."""
    s = get_settings()
    return bool(s.resend_api_key)


def _send_via_resend(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    attachments: list[dict] | None = None,
) -> None:
    """Send an email via Resend API."""
    s = get_settings()
    resend.api_key = s.resend_api_key

    params: dict = {
        "from": s.resend_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        params["text"] = text
    if attachments:
        params["attachments"] = attachments

    log.info("Envoi via Resend API -> Destinataire: %s | Expéditeur: %s", to, s.resend_from)
    resend.Emails.send(params)
    log.info("E-mail envoyé avec succès à %s via Resend", to)


def send_tickets_email(
    to: str,
    name: str,
    concert: str,
    date_txt: str,
    venue: str,
    type_name: str,
    images: list[tuple[str, bytes]],
    is_paid: bool = True,
    unit_price: int = 0,
) -> None:
    s = get_settings()
    if not s.resend_api_key:
        log.warning("Resend non configuré : e-mail non envoyé à %s", to)
        return

    status_label = "Paiement Validé (Accès direct)" if is_paid else f"Réservation (Paiement sur place à l'entrée : {unit_price:,} Ar/billet)".replace(",", " ")
    badge_color = "#059669" if is_paid else "#d97706"
    badge_bg = "#ecfdf5" if is_paid else "#fffbeb"
    badge_border = "#a7f3d0" if is_paid else "#fde68a"

    subject = f"[ITIX] Vos billets - {concert}" + (" (Payé)" if is_paid else " (Réservation)")

    blocks = "".join(
        f'<div style="margin:16px 0;padding:20px;border:1px solid #334155;border-radius:14px;text-align:center;background:#0f172a;">'
        f'<p style="margin:0 0 10px 0;font-size:16px;font-weight:bold;color:#f8fafc;">{escape(num)} — <span style="color:#00D4FF;">{escape(type_name)}</span></p>'
        f'<img src="data:image/png;base64,{base64.b64encode(png).decode()}" width="220" height="220" alt="QR {escape(num)}" style="display:inline-block;border-radius:10px;border:2px solid #00D4FF;padding:8px;background:#ffffff;">'
        f'<p style="margin:10px 0 0 0;font-size:12px;font-family:monospace;color:#94a3b8;letter-spacing:1px;">BILLET N° {escape(num)}</p>'
        f'</div>'
        for num, png in images
    )

    html = (
        f"<!DOCTYPE html><html><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;color:#f8fafc;line-height:1.6;margin:0;padding:24px;background:#020617;'>"
        f"<div style='max-width:580px;margin:0 auto;background:#0b1329;border-radius:20px;overflow:hidden;border:1px solid #1e293b;padding:28px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);'>"
        f"<div style='text-align:center;margin-bottom:20px;'>"
        f"<span style='font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#00D4FF;text-transform:uppercase;'>ITIX</span>"
        f"<span style='display:block;font-size:10px;letter-spacing:2px;color:#64748b;text-transform:uppercase;margin-top:2px;'>Event & Ticketing Platform</span>"
        f"</div>"
        f"<h1 style='font-size:20px;color:#ffffff;margin-top:0;text-align:center;'>Vos billets pour <span style='color:#00D4FF;'>{escape(concert)}</span></h1>"
        f"<p style='margin:14px 0;color:#cbd5e1;'>Bonjour <b>{escape(name)}</b>,</p>"
        f"<p style='margin:14px 0;color:#94a3b8;'>Votre réservation est confirmée. Retrouvez vos billets d'accès avec QR Code ci-dessous :</p>"
        f"<div style='background:#0f172a;padding:16px 20px;border-radius:12px;margin:18px 0;font-size:13px;border:1px solid #1e293b;'>"
        f"<p style='margin:5px 0;color:#e2e8f0;'><b>Date :</b> {escape(date_txt)}</p>"
        f"<p style='margin:5px 0;color:#e2e8f0;'><b>Lieu :</b> {escape(venue)}</p>"
        f"<p style='margin:5px 0;color:#e2e8f0;'><b>Catégorie :</b> {escape(type_name)} ({len(images)} place(s))</p>"
        f"<div style='margin-top:10px;display:inline-block;padding:5px 12px;border-radius:8px;font-weight:bold;font-size:12px;background:{badge_bg};color:{badge_color};border:1px solid {badge_border};'>"
        f"{escape(status_label)}"
        f"</div>"
        f"</div>"
        f"{blocks}"
        f"<p style='font-size:12px;color:#64748b;margin-top:24px;text-align:center;border-top:1px solid #1e293b;padding-top:18px;'>"
        f"Présentez ce QR Code directement sur votre écran de smartphone lors du contrôle à l'entrée.<br>Chaque billet est individuel et strictement à usage unique."
        f"</p>"
        f"</div>"
        f"</body></html>"
    )

    text_content = (
        f"Bonjour {name},\n\n"
        f"Votre commande pour l'événement '{concert}' ({date_txt}, {venue}) est confirmée sur ITIX.\n"
        f"Statut : {status_label}\n"
        f"Type de billet : {type_name} ({len(images)} place(s))\n\n"
        f"Vos {len(images)} billet(s) avec QR Code d'accès sont joints à ce message.\n"
        f"Présentez le QR Code de chaque billet directement sur votre smartphone à l'entrée.\n\n"
        f"À très bientôt,\nL'équipe ITIX Event"
    )

    # Build attachments for Resend
    attachments = [
        {
            "filename": f"ITIX_Billet_{num}.png",
            "content": list(png),
        }
        for num, png in images
    ]

    try:
        _send_via_resend(to, subject, html, text=text_content, attachments=attachments)
    except Exception:
        log.exception("Échec de l'envoi de billets par e-mail à %s", to)


def send_test_email(to: str) -> dict:
    s = get_settings()
    date_now_str = local_now().strftime("%d/%m/%Y à %H:%M:%S")

    html = (
        f"<!DOCTYPE html><html><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;color:#f8fafc;line-height:1.6;margin:0;padding:24px;background:#020617;'>"
        f"<div style='max-width:580px;margin:0 auto;background:#0b1329;border-radius:20px;overflow:hidden;border:1px solid #1e293b;padding:28px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);'>"
        f"<div style='text-align:center;margin-bottom:16px;'>"
        f"<span style='font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#00D4FF;'>ITIX</span>"
        f"<span style='display:block;font-size:10px;letter-spacing:2px;color:#64748b;text-transform:uppercase;margin-top:2px;'>Event & Ticketing Platform</span>"
        f"</div>"
        f"<h2 style='color:#10b981;margin-top:0;text-align:center;font-size:18px;'>Test de configuration e-mail réussi</h2>"
        f"<p style='color:#cbd5e1;font-size:13px;'>Bonjour,</p>"
        f"<p style='color:#94a3b8;font-size:13px;'>Le serveur d'envoi d'e-mails de votre plateforme ITIX est <b>pleinement opérationnel</b>.</p>"
        f"<div style='background:#0f172a;padding:16px 20px;border-radius:12px;margin:18px 0;font-size:12px;border:1px solid #1e293b;'>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Fournisseur :</b> Resend API</p>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Expéditeur :</b> {escape(s.resend_from)}</p>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Date du test :</b> {date_now_str}</p>"
        f"</div>"
        f"<p style='color:#64748b;font-size:11px;text-align:center;'>Les billets avec QR Code et confirmations de commandes parviendront directement aux clients.</p>"
        f"</div></body></html>"
    )

    try:
        _send_via_resend(to, "[ITIX] Test de diagnostic e-mail réussi", html)
        return {
            "success": True,
            "message": f"E-mail de test envoyé avec succès à {to}",
            "details": {
                "provider": "Resend API",
                "from": s.resend_from,
                "recipient": to,
            }
        }
    except Exception as e:
        error_msg = str(e)
        return {
            "success": False,
            "error": f"{type(e).__name__}: {error_msg}",
            "hint": "Vérifiez que la clé RESEND_API_KEY est valide et que le domaine expéditeur est autorisé sur resend.com.",
            "details": {
                "provider": "Resend API",
                "from": s.resend_from,
                "recipient": to,
            }
        }
