import crypto from "node:crypto";

/**
 * 网易云 weapi 请求加密（与 NeteaseCloudMusicApi 同源算法）：
 * 1. 随机 16 字符 base62 密钥
 * 2. 载荷先以固定密钥 AES-128-CBC 加密，再以随机密钥二次加密 → params
 * 3. 随机密钥反转后 RSA（NO_PADDING，左零填充至 128 字节）→ encSecKey
 * 仅服务端使用（node:crypto），不进入浏览器包。
 */

const IV = Buffer.from("0102030405060708");
const PRESET_KEY = Buffer.from("0CoJUm6Qyw8W8jud");
const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----";

function aesCbc(buffer: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

function rsaEncryptNoPadding(buffer: Buffer): Buffer {
  const padded = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer]);
  return crypto.publicEncrypt(
    { key: PUBLIC_KEY, padding: crypto.constants.RSA_NO_PADDING },
    padded
  );
}

export function weapi(object: Record<string, unknown>): { params: string; encSecKey: string } {
  const text = JSON.stringify(object);
  const secretKey = crypto.randomBytes(16).map((n) => BASE62.charCodeAt(n % 62));
  const sk = Buffer.from(secretKey);
  const params = aesCbc(
    Buffer.from(aesCbc(Buffer.from(text), PRESET_KEY).toString("base64")),
    sk
  ).toString("base64");
  const encSecKey = rsaEncryptNoPadding(Buffer.from(sk).reverse()).toString("hex");
  return { params, encSecKey };
}
