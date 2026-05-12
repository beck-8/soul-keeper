import { buildEncStructure } from '../cose/structures.js';
import { aesGcmDecrypt, aesGcmEncrypt, getRandomValues } from '../crypto.js';
import { AuthenticationError } from '../errors.js';
const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 16;
export class Aes256Gcm {
    name = 'AES-256-GCM';
    algorithmId = 3;
    isSeekable = false;
    async encrypt(key, plaintext, protectedHeaders) {
        const iv = getRandomValues(AES_GCM_IV_LENGTH);
        const aad = buildEncStructure('Encrypt0', protectedHeaders, new Uint8Array(0));
        const ciphertext = await aesGcmEncrypt(key, iv, plaintext, aad);
        return { ciphertext, iv };
    }
    async decrypt(key, ciphertext, iv, protectedHeaders, _metadata) {
        const aad = buildEncStructure('Encrypt0', protectedHeaders, new Uint8Array(0));
        try {
            return await aesGcmDecrypt(key, iv, ciphertext, aad);
        }
        catch {
            throw new AuthenticationError('AEAD authentication failed — wrong key or tampered ciphertext');
        }
    }
}
export { AES_GCM_IV_LENGTH, AES_GCM_TAG_LENGTH };
