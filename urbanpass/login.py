"""Log in to Wellpass once. Usage: python -m urbanpass.login

Asks for your Wellpass email and password in this terminal. The password is not stored;
only a refresh token is saved to .secrets/wellpass.json (git-ignored).
"""
import getpass

from .wellpass_auth import SECRETS, AuthError, class_sessions, id_token, login


def main():
    email = input("Wellpass email: ").strip()
    password = getpass.getpass("Wellpass password (hidden): ")
    try:
        login(email, password)
        id_token()
        # Smoke test: one Berlin studio's classes for the next day.
        class_sessions("3045fffd-36eb-4fca-9228-0edd083fc759", "2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z")
    except AuthError as e:
        print(f"Login failed: {e}")
        raise SystemExit(1)
    print(f"Logged in. Token saved to {SECRETS}")


if __name__ == "__main__":
    main()
