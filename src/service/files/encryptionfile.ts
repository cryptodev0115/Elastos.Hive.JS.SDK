import {EncryptionValue} from "../../utils/encryption/encryptionvalue";

export class EncryptionFile extends EncryptionValue {
    constructor(cipher, value: Buffer | string) {
        super(cipher, value);
    }

    encrypt(): Buffer {
        let data: Buffer = this.value instanceof Buffer ? this.value : Buffer.from(this.value);
        return this.encryptStream(data);
    }

    decrypt() {
        let data: Buffer = this.value instanceof Buffer ? this.value : Buffer.from(this.value);
        return this.decryptStream(data);
    }

}
