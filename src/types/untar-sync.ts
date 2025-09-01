declare module 'untar-sync' {
  export default function untarSync(buffer: ArrayBuffer): tarFile[];
}

interface tarFile {
  name: string;
  buffer: ArrayBuffer;
  type: string;
  linkname?: string;
}
