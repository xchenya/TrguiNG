import { Buffer } from "buffer";
import type { CountryResponse } from "mmdb-lib";
import { Reader } from "mmdb-lib";

export interface IpLookupResult {
    ip: string,
    isoCode?: string,
    name?: string,
}

let readerPromise: Promise<Reader<CountryResponse>> | undefined;

async function getReader() {
    readerPromise ??= fetch("dbip.mmdb.gz")
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`GeoIP database returned error: ${response.status} (${response.statusText})`);
            }
            if (response.body === null) throw new Error("GeoIP database response has no body");
            const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
            return new Reader<CountryResponse>(Buffer.from(await new Response(decompressed).arrayBuffer()));
        });
    return await readerPromise;
}

export async function lookupIps(ips: string[]): Promise<IpLookupResult[]> {
    const reader = await getReader();
    return ips.map((ip) => {
        const country = reader.get(ip)?.country;
        return {
            ip,
            isoCode: country?.iso_code,
            name: country?.names["zh-CN"] ?? country?.names.en,
        };
    });
}
