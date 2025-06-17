/* eslint-disable @typescript-eslint/no-non-null-assertion */
import CryptoJS from "crypto-js";
import { customType } from "drizzle-orm/sqlite-core";

export const encryptedText = customType<{ data: string }>({
  dataType() {
    return "text";
  },
  fromDriver(value: unknown) {
    return CryptoJS.AES.decrypt(
      String(value),
      process.env.AUTH_SECRET!,
    ).toString(CryptoJS.enc.Utf8);
  },
  toDriver(value: string) {
    return CryptoJS.AES.encrypt(value, process.env.AUTH_SECRET!).toString();
  },
});

// Added type alias for JSON values
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

// New custom type to encrypt/decrypt JSON objects
export function encryptedJSON<X extends JSONValue>() {
  return customType<{ data: X; driverData: string }>({
    dataType() {
      return "text";
    },
    fromDriver(value: unknown): X {
      const decrypted = CryptoJS.AES.decrypt(
        String(value),
        process.env.AUTH_SECRET!,
      ).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted) as X;
    },
    toDriver(value: X): string {
      const jsonValue = JSON.stringify(value);
      return CryptoJS.AES.encrypt(
        jsonValue,
        process.env.AUTH_SECRET!,
      ).toString();
    },
  });
}
