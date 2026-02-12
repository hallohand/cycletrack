'use client';

// WebAuthn Helper Functions for App Lock
// Note: This implementation is for local-only "Privacy Lock".
// It relies on the platform authenticator (FaceID/TouchID/PIN) to verify the user presence.
// We do not verify the signature on a server, we just trust the browser's success signal.

const CREDENTIAL_ID_KEY = 'cycletrack_lock_credential_id';

export function isAppLockEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(CREDENTIAL_ID_KEY);
}

export async function registerPasskey(): Promise<boolean> {
    if (!window.PublicKeyCredential) {
        console.error('WebAuthn not supported');
        return false;
    }

    try {
        // Create random challenge (required by spec, even if local)
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const options: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: 'CycleTrack App Lock',
                id: window.location.hostname, // Must match current domain
            },
            user: {
                id: userId,
                name: 'user@cycletrack.local',
                displayName: 'CycleTrack User',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // This forces FaceID/TouchID/Windows Hello
                userVerification: 'required',
            },
            timeout: 60000,
            attestation: 'none',
        };

        const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;

        if (!credential) return false;

        // Store Credential ID (to allow-list it for login later)
        // We need to convert ArrayBuffer to Base64 string for storage
        const rawId = credential.rawId;
        const base64Id = bufferToBase64(rawId);

        localStorage.setItem(CREDENTIAL_ID_KEY, base64Id);
        return true;
    } catch (e) {
        console.error('Registration failed', e);
        return false;
    }
}

export async function authenticatePasskey(): Promise<boolean> {
    const storedId = localStorage.getItem(CREDENTIAL_ID_KEY);
    if (!storedId) return true; // Not enabled, so "authenticated" by default (or handle as error?)

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const allowList: PublicKeyCredentialDescriptor[] = [{
            id: base64ToBuffer(storedId),
            type: 'public-key',
            transports: ['internal'],
        }];

        const options: PublicKeyCredentialRequestOptions = {
            challenge,
            rpId: window.location.hostname,
            allowCredentials: allowList,
            userVerification: 'required',
        };

        const assertion = await navigator.credentials.get({ publicKey: options });

        // If we get an assertion, the platform authenticator successfully verified the user.
        return !!assertion;
    } catch (e) {
        console.error('Authentication failed', e);
        return false;
    }
}

export function disableAppLock() {
    localStorage.removeItem(CREDENTIAL_ID_KEY);
}


// --- ArrayBuffer Utils ---

function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
