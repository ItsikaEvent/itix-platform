import logging
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from html import escape

from app.core.config import get_settings
from app.core.timeutil import local_now

log = logging.getLogger("mailer")


def smtp_configured() -> bool:
    s = get_settings()
    return bool(s.smtp_host and s.smtp_from)


def _format_from_header(from_address: str) -> str:
    if "<" in from_address:
        return from_address
    return f"ITIX Platform <{from_address}>"


def _send_smtp_message(msg: EmailMessage, recipient: str) -> None:
    s = get_settings()
    if not s.smtp_host:
        log.warning("SMTP non configuré (SMTP_HOST est vide). Impossible d'envoyer l'e-mail à %s", recipient)
        raise ValueError("SMTP non configuré : variable SMTP_HOST manquante dans l'environnement")

    log.info(
        "Tentative d'envoi SMTP -> Hôte: %s:%s | Expéditeur: %s | Destinataire: %s | Utilisateur: %s",
        s.smtp_host, s.smtp_port, msg.get("From"), recipient, s.smtp_username or "(aucun)",
    )

    try:
        if s.smtp_port == 465:
            log.info("Connexion SMTP sécurisée directe via SSL (port 465)...")
            smtp_client = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=20)
        else:
            log.info("Connexion SMTP standard vers %s:%s...", s.smtp_host, s.smtp_port)
            smtp_client = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20)

        with smtp_client as smtp:
            smtp.ehlo()
            if s.smtp_port != 465:
                if s.smtp_port == 587 or smtp.has_extn("STARTTLS"):
                    log.info("Activation du chiffrement STARTTLS...")
                    smtp.starttls()
                    smtp.ehlo()

            if s.smtp_username:
                log.info("Authentification SMTP pour le compte '%s'...", s.smtp_username)
                smtp.login(s.smtp_username, s.smtp_password)

            log.info("Envoi du message à %s...", recipient)
            smtp.send_message(msg)
            log.info("✅ E-mail envoyé avec succès à %s", recipient)

    except smtplib.SMTPAuthenticationError as e:
        code = getattr(e, "smtp_code", 535)
        error_msg = getattr(e, "smtp_error", str(e))
        if isinstance(error_msg, bytes):
            error_msg = error_msg.decode("utf-8", errors="replace")
        log.error(
            "❌ ÉCHEC D'AUTHENTIFICATION SMTP (Code %s): %s. "
            "Attention: Pour Gmail (smtp.gmail.com), vous NE DEVEZ PAS utiliser le mot de passe standard de votre compte. "
            "Vous devez activer la validation en 2 étapes sur Google et générer un 'Mot de passe d'application' "
            "(16 caractères) sur https://myaccount.google.com/apppasswords.",
            code, error_msg,
        )
        raise
    except smtplib.SMTPConnectError as e:
        log.error("❌ ÉCHEC DE CONNEXION SMTP à %s:%s : %s", s.smtp_host, s.smtp_port, e)
        raise
    except smtplib.SMTPRecipientsRefused as e:
        log.error("❌ DESTINATAIRE REFUSÉ par le serveur SMTP pour %s : %s", recipient, e)
        raise
    except smtplib.SMTPException as e:
        log.error("❌ ERREUR SMTP lors de l'envoi à %s : %s", recipient, e)
        raise
    except Exception as e:
        log.exception("❌ ERREUR INATTENDUE lors de l'envoi SMTP à %s : %s", recipient, e)
        raise


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
    if not s.smtp_host:
        log.warning("SMTP non configuré : e-mail non envoyé à %s", to)
        return

    msg = EmailMessage()
    status_label = "Paiement Validé (Accès direct)" if is_paid else f"Réservation (Paiement sur place à l'entrée : {unit_price:,} Ar/billet)".replace(",", " ")
    badge_color = "#059669" if is_paid else "#d97706"
    badge_bg = "#ecfdf5" if is_paid else "#fffbeb"
    badge_border = "#a7f3d0" if is_paid else "#fde68a"

    msg["Subject"] = f"🎟️ [ITIX] Vos billets - {concert}" + (" (Payé)" if is_paid else " (Réservation)")
    msg["From"] = _format_from_header(s.smtp_from)
    msg["To"] = to
    msg["Reply-To"] = s.smtp_from
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="itix.events")
    msg["X-Mailer"] = "ITIX-Event-Platform"

    msg.set_content(
        f"Bonjour {name},\n\n"
        f"Votre commande pour l'événement '{concert}' ({date_txt}, {venue}) est confirmée sur ITIX.\n"
        f"Statut : {status_label}\n"
        f"Type de billet : {type_name} ({len(images)} place(s))\n\n"
        f"Vos {len(images)} billet(s) avec QR Code d'accès sont joints à ce message (fichiers PNG).\n"
        f"Présentez le QR Code de chaque billet directement sur votre smartphone à l'entrée. Un billet ne peut être utilisé qu'une seule fois.\n\n"
        f"À très bientôt,\nL'équipe ITIX Event"
    )

    import base64
    blocks = "".join(
        f'<div style="margin:16px 0;padding:20px;border:1px solid #334155;border-radius:14px;text-align:center;background:#0f172a;">'
        f'<p style="margin:0 0 10px 0;font-size:16px;font-weight:bold;color:#f8fafc;">{escape(num)} — <span style="color:#00D4FF;">{escape(type_name)}</span></p>'
        f'<img src="data:image/png;base64,{base64.b64encode(png).decode()}" width="220" height="220" alt="QR {escape(num)}" style="display:inline-block;border-radius:10px;border:2px solid #00D4FF;padding:8px;background:#ffffff;">'
        f'<p style="margin:10px 0 0 0;font-size:12px;font-family:monospace;color:#94a3b8;letter-spacing:1px;">BILLET N° {escape(num)}</p>'
        f'</div>'
        for num, png in images
    )

    msg.add_alternative(
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
        f"<p style='margin:5px 0;color:#e2e8f0;'>📅 <b>Date :</b> {escape(date_txt)}</p>"
        f"<p style='margin:5px 0;color:#e2e8f0;'>📍 <b>Lieu :</b> {escape(venue)}</p>"
        f"<p style='margin:5px 0;color:#e2e8f0;'>🎫 <b>Catégorie :</b> {escape(type_name)} ({len(images)} place(s))</p>"
        f"<div style='margin-top:10px;display:inline-block;padding:5px 12px;border-radius:8px;font-weight:bold;font-size:12px;background:{badge_bg};color:{badge_color};border:1px solid {badge_border};'>"
        f"● {escape(status_label)}"
        f"</div>"
        f"</div>"
        f"{blocks}"
        f"<p style='font-size:12px;color:#64748b;margin-top:24px;text-align:center;border-top:1px solid #1e293b;padding-top:18px;'>"
        f"Présentez ce QR Code directement sur votre écran de smartphone lors du contrôle à l'entrée.<br>Chaque billet est individuel et strictement à usage unique."
        f"</p>"
        f"</div>"
        f"</body></html>",
        subtype="html"
    )

    for num, png in images:
        msg.add_attachment(png, maintype="image", subtype="png", filename=f"ITIX_Billet_{num}.png")

    try:
        _send_smtp_message(msg, to)
    except Exception:
        log.exception("Échec de l'envoi de billets par e-mail à %s", to)


def send_test_email(to: str) -> dict:
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"] = "🚀 [ITIX] Test de diagnostic SMTP réussi"
    msg["From"] = _format_from_header(s.smtp_from)
    msg["To"] = to
    msg["Reply-To"] = s.smtp_from
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="itix.events")
    msg["X-Mailer"] = "ITIX-Event-Platform"

    date_now_str = local_now().strftime("%d/%m/%Y à %H:%M:%S")
    msg.set_content(
        f"Bonjour,\n\n"
        f"Ceci est un e-mail de test envoyé depuis votre plateforme ITIX.\n"
        f"Si vous recevez ce message, la configuration SMTP ({s.smtp_host}:{s.smtp_port}) fonctionne parfaitement !\n\n"
        f"Expéditeur : {s.smtp_from}\n"
        f"Date : {date_now_str}\n\n"
        f"L'équipe ITIX Platform"
    )
    msg.add_alternative(
        f"<!DOCTYPE html><html><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;color:#f8fafc;line-height:1.6;margin:0;padding:24px;background:#020617;'>"
        f"<div style='max-width:580px;margin:0 auto;background:#0b1329;border-radius:20px;overflow:hidden;border:1px solid #1e293b;padding:28px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);'>"
        f"<div style='text-align:center;margin-bottom:16px;'>"
        f"<span style='font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#00D4FF;'>ITIX</span>"
        f"<span style='display:block;font-size:10px;letter-spacing:2px;color:#64748b;text-transform:uppercase;margin-top:2px;'>Event & Ticketing Platform</span>"
        f"</div>"
        f"<h2 style='color:#10b981;margin-top:0;text-align:center;font-size:18px;'>✓ Test de configuration SMTP réussi</h2>"
        f"<p style='color:#cbd5e1;font-size:13px;'>Bonjour,</p>"
        f"<p style='color:#94a3b8;font-size:13px;'>Le serveur d'envoi d'e-mails de votre plateforme ITIX est <b>pleinement opérationnel</b>.</p>"
        f"<div style='background:#0f172a;padding:16px 20px;border-radius:12px;margin:18px 0;font-size:12px;border:1px solid #1e293b;'>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Serveur SMTP :</b> {escape(s.smtp_host)}:{s.smtp_port}</p>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Expéditeur :</b> {escape(s.smtp_from)}</p>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Utilisateur :</b> {escape(s.smtp_username or '(aucun)')}</p>"
        f"<p style='margin:4px 0;color:#e2e8f0;'><b>Date du test :</b> {date_now_str}</p>"
        f"</div>"
        f"<p style='color:#64748b;font-size:11px;text-align:center;'>Les billets avec QR Code et confirmations de commandes parviendront directement aux clients.</p>"
        f"</div></body></html>",
        subtype="html"
    )
    try:
        _send_smtp_message(msg, to)
        return {
            "success": True,
            "message": f"E-mail de test envoyé avec succès à {to}",
            "details": {
                "smtp_host": s.smtp_host,
                "smtp_port": s.smtp_port,
                "smtp_from": s.smtp_from,
                "smtp_username": s.smtp_username,
                "recipient": to,
            }
        }
    except Exception as e:
        error_msg = str(e)
        hint = ""
        if isinstance(e, smtplib.SMTPAuthenticationError) or "535" in error_msg or "BadCredentials" in error_msg:
            hint = (
                "Erreur d'authentification Gmail (535 BadCredentials) : "
                "Google interdit l'utilisation directe du mot de passe standard de votre compte. "
                "Vous devez activer la 'Validation en 2 étapes' sur votre compte Google (itsikaevent.mdg@gmail.com) "
                "puis générer un 'Mot de passe d'application' de 16 caractères sur https://myaccount.google.com/apppasswords "
                "et le renseigner dans SMTP_PASSWORD."
            )
        elif isinstance(e, smtplib.SMTPConnectError):
            hint = f"Impossible de contacter le serveur {s.smtp_host}:{s.smtp_port}. Vérifiez votre connexion Internet et vos pare-feu."
        return {
            "success": False,
            "error": f"{type(e).__name__}: {error_msg}",
            "hint": hint,
            "details": {
                "smtp_host": s.smtp_host,
                "smtp_port": s.smtp_port,
                "smtp_from": s.smtp_from,
                "smtp_username": s.smtp_username,
                "recipient": to,
            }
        }
