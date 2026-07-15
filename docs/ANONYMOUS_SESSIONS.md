# Anonymous demo sessions

Browser access is an anonymous hackathon demonstration, not production authentication. `POST /api/demo/session` generates a cryptographically random opaque token. PostgreSQL stores only a secret-bound SHA-256 hash. The raw token is held in an HttpOnly, SameSite=Lax cookie and marked Secure in production.

Sessions collect no name, email, or phone number. Each session owns an independent account. Purchase requests never accept an account ID; the server derives it exclusively from the cookie. Set a private `DEMO_SESSION_SECRET` of at least 16 characters. The Judge reset action issues a new isolated session.
