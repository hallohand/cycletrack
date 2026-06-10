import { describe, it, expect } from 'vitest';
import { encryptBackup, decryptBackup, isEncryptedPayload } from '../backup';

// Node ≥ 20 exposes Web Crypto on globalThis.crypto, same API as browsers.

describe('backup encryption (AES-GCM + PBKDF2)', () => {
    const sample = JSON.stringify({
        entries: { '2026-06-01': { date: '2026-06-01', period: 'medium', temperature: 36.5 } },
        cycleLength: 28,
    });

    it('round-trips plaintext through encrypt/decrypt', async () => {
        const payload = await encryptBackup(sample, 'korrektes-passwort');
        expect(isEncryptedPayload(payload)).toBe(true);
        expect(payload.ciphertext).not.toContain('2026-06-01');

        const decrypted = await decryptBackup(payload, 'korrektes-passwort');
        expect(decrypted).toBe(sample);
    });

    it('fails to decrypt with a wrong passphrase (AEAD integrity)', async () => {
        const payload = await encryptBackup(sample, 'korrektes-passwort');
        await expect(decryptBackup(payload, 'falsches-passwort')).rejects.toThrow();
    });

    it('uses a fresh salt and IV for every encryption', async () => {
        const a = await encryptBackup(sample, 'pw');
        const b = await encryptBackup(sample, 'pw');
        expect(a.salt).not.toBe(b.salt);
        expect(a.iv).not.toBe(b.iv);
        expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it('does not leak health data in the serialized payload', async () => {
        const payload = await encryptBackup(sample, 'pw');
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain('period');
        expect(serialized).not.toContain('36.5');
    });

    it('rejects non-encrypted objects in the type guard', () => {
        expect(isEncryptedPayload({ entries: {} })).toBe(false);
        expect(isEncryptedPayload(null)).toBe(false);
        expect(isEncryptedPayload('text')).toBe(false);
    });
});
