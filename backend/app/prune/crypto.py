import json
import logging
from typing import Dict, Any, Tuple
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

logger = logging.getLogger("coframe.prune.crypto")

# Deterministic keypair or freshly initialized keypair for the Prune Gateway instance
_PRIVATE_KEY: ed25519.Ed25519PrivateKey = ed25519.Ed25519PrivateKey.generate()
_PUBLIC_KEY: ed25519.Ed25519PublicKey = _PRIVATE_KEY.public_key()


def get_public_key_hex() -> str:
    """Returns the hex-encoded Ed25519 public key."""
    return _PUBLIC_KEY.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    ).hex()


def canonical_json_bytes(data: Dict[str, Any]) -> bytes:
    """Serializes a dictionary to canonical sorted JSON bytes for cryptographic signing."""
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_receipt_payload(payload: Dict[str, Any]) -> Tuple[str, str]:
    """
    Cryptographically signs a Prune receipt dictionary using Ed25519.
    Returns: (signature_hex, public_key_hex)
    """
    msg_bytes = canonical_json_bytes(payload)
    signature = _PRIVATE_KEY.sign(msg_bytes)
    pub_hex = get_public_key_hex()
    return signature.hex(), pub_hex


def verify_receipt_signature(payload: Dict[str, Any], signature_hex: str, public_key_hex: str) -> bool:
    """
    Verifies the Ed25519 cryptographic signature of a receipt against its public key.
    """
    try:
        msg_bytes = canonical_json_bytes(payload)
        sig_bytes = bytes.fromhex(signature_hex)
        pub_bytes = bytes.fromhex(public_key_hex)
        verify_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        verify_key.verify(sig_bytes, msg_bytes)
        return True
    except (InvalidSignature, ValueError, Exception) as e:
        logger.warning(f"Ed25519 signature verification failed: {e}")
        return False
