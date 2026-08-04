/**
 * TrguiNG - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2023  qu1ck (mail at qu1ck.org)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { BandwidthGroupFieldType, PeerStatsFieldsType, TorrentAllFieldsType, TrackerStatsFieldsType } from "./transmission";
import { Status } from "./transmission";
import React, { useContext } from "react";
import type { TransmissionClient } from "./client";

export type TrackerStats = Partial<Record<TrackerStatsFieldsType, any>>;
export type BandwidthGroup = Record<BandwidthGroupFieldType, any>;
export type TorrentBase = Partial<Record<TorrentAllFieldsType, any>>;

export interface Torrent extends TorrentBase {
    cachedError: string,
    cachedTrackerStatus: string,
    cachedMainTracker: string,
    cachedPeersTotal: number,
    cachedSeedsTotal: number,
}

function getTorrentError(t: TorrentBase): string {
    let torrentError = t.errorString;
    let trackerError = "";
    let noTrackerError = false;

    for (const trackerStat of t.trackerStats) {
        let err = "";
        if (trackerStat.hasAnnounced as boolean && !(trackerStat.lastAnnounceSucceeded as boolean)) {
            err = trackerStat.lastAnnounceResult as string;
        }
        if (err === "" || err === "Success") {
            noTrackerError = true;
        } else if (trackerError === "") {
            // If the torrent error string is equal to some tracker error string,
            // then igonore the global error string
            if (err === torrentError) torrentError = "";
            trackerError = `Tracker: ${err}`;
        }
    }

    if (noTrackerError || t.status === Status.stopped) {
        return torrentError;
    } else {
        return trackerError;
    }
}

function globToRegex(glob: string): RegExp {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${pattern}$`, "i");
}

function isErrorIgnored(error: string, ignoredErrors: string[]): boolean {
    if (error === "") return false;
    for (const pattern of ignoredErrors) {
        if (pattern === "" || pattern.trim() === "") continue;
        if (pattern === error) return true;
        try {
            if (globToRegex(pattern).test(error)) return true;
        } catch { /* ignore invalid patterns */ }
    }
    return false;
}

export function getTrackerAnnounceState(tracker: TrackerStats) {
    if (tracker.announceState === 3) return "工作(上传中)";
    if (tracker.hasAnnounced as boolean) {
        if (tracker.lastAnnounceSucceeded as boolean) return "工作";
        if (tracker.lastAnnounceResult === "Success") return "工作";
        return tracker.lastAnnounceResult;
    }
    return "";
}

function getTrackerStatus(torrent: TorrentBase): string {
    const trackers = torrent.trackerStats as TrackerStats[];
    if (torrent.status === Status.stopped || trackers.length === 0) return "";
    return getTrackerAnnounceState(trackers[0]);
}

const portRe = /:\d+$/;
const prefixRe = /^((t|tr|tk|tracker|bt|open|opentracker)\d*)\.[^.]+\.[^.]+$/;

function getTorrentMainTracker(t: TorrentBase): string {
    if (t.trackerStats.length === 0) return "<No trackers>";
    let host = t.trackerStats[0].host as string;
    const portMatch = portRe.exec(host);
    if (portMatch != null) host = host.substring(0, portMatch.index);
    const prefixMatch = prefixRe.exec(host);
    if (prefixMatch != null) host = host.substring(prefixMatch[1].length + 1);
    return host;
}

function getSeedsTotal(t: TorrentBase) {
    let seeds = t.trackerStats.length > 0 ? 0 : -1;
    t.trackerStats.forEach(
        (tracker: TrackerStats) => { seeds = Math.max(seeds, tracker.seederCount as number); });
    return seeds;
}

function getPeersTotal(t: TorrentBase) {
    let peers = t.trackerStats.length > 0 ? 0 : -1;
    t.trackerStats.forEach(
        (tracker: TrackerStats) => { peers = Math.max(peers, tracker.leecherCount as number); });
    return peers;
}

export async function processTorrent(t: TorrentBase, lookupIps: boolean, client: TransmissionClient, ignoredErrors?: string[]): Promise<Torrent> {
    const peers = t.peers === undefined
        ? undefined
        : await Promise.all(t.peers.map(async (p: PeerStatsBase) => await processPeerStats(p, lookupIps, client)));

    let cachedError = getTorrentError(t);
    let error = t.error as number;

    if (ignoredErrors !== undefined && ignoredErrors.length > 0 && isErrorIgnored(cachedError, ignoredErrors)) {
        cachedError = "";
        error = 0;
    }

    return {
        ...t,
        error,
        downloadDir: (t.downloadDir as string).replaceAll("\\", "/"),
        cachedError,
        cachedTrackerStatus: getTrackerStatus(t),
        cachedMainTracker: getTorrentMainTracker(t),
        cachedSeedsTotal: getSeedsTotal(t),
        cachedPeersTotal: getPeersTotal(t),
        peers,
    };
}

export interface ServerTorrentData {
    torrents: Torrent[],
    current: number | undefined,
}

export const ServerTorrentDataContext = React.createContext<ServerTorrentData>({
    torrents: [],
    current: undefined,
});

export function useServerTorrentData() {
    return useContext(ServerTorrentDataContext);
}

export const ServerRpcVersionContext = React.createContext<number>(0);

export function useServerRpcVersion() {
    return useContext(ServerRpcVersionContext);
}

export const ServerSelectedTorrentsContext = React.createContext<Set<number>>(new Set());

export function useServerSelectedTorrents() {
    return useContext(ServerSelectedTorrentsContext);
}

type PeerStatsBase = Partial<Record<PeerStatsFieldsType, any>>;

export interface PeerStats extends PeerStatsBase {
    cachedEncrypted: string,
    cachedFrom: string,
    cachedConnection: string,
    cachedProtocol: string,
    cachedStatus: string,
    cachedCountryIso?: string,
    cachedCountryName?: string,
}

// Flag meanings: https://github.com/transmission/transmission/blob/main/docs/Peer-Status-Text.md

const statusFlagStrings = {
    O: "O",
    D: "D",
    d: "d",
    U: "U",
    u: "u",
    K: "K",
    "?": "?",
} as const;

async function processPeerStats(peer: PeerStatsBase, lookupIps: boolean, client: TransmissionClient): Promise<PeerStats> {
    const flags = peer.flagStr as string;

    const cachedFrom = flags.includes("X")
        ? "PEX"
        : flags.includes("H")
            ? "DHT"
            : "Tracker";

    const status = [...flags.matchAll(/[ODdUuK?]/g)].map(
        (s) => statusFlagStrings[s[0] as keyof (typeof statusFlagStrings)]);

    const country = lookupIps
        ? await client.ipsBatcher.fetch(peer.address)
        : undefined;

    return {
        ...peer,
        cachedEncrypted: flags.includes("E") ? "是" : "否",
        cachedFrom,
        cachedConnection: flags.includes("I") ? "传入" : "输出",
        cachedProtocol: flags.includes("T") ? "µTP" : "TCP",
        cachedStatus: (status ?? []).join(""),
        cachedCountryIso: country?.isoCode,
        cachedCountryName: country?.name,
    };
}
