/**
 * Demo replacement for src/queries.ts.
 * Webpack NormalModuleReplacementPlugin swaps this in when BUILD_MODE=demo.
 * Production builds never see this file.
 */

import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { CachedFileTree } from "cachedfiletree";
import { ConfigContext, ServerConfigContext } from "config";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SessionInfo, TorrentActionMethodsType, TorrentAddParams } from "rpc/client";
import { useTransmissionClient } from "rpc/client";
import type { Torrent, TorrentBase } from "rpc/torrent";
import { processTorrent } from "rpc/torrent";
import type { TorrentMutableFieldsType, TorrentFieldsType, TorrentAllFieldsType } from "rpc/transmission";
import { mockTorrents, mockSession, mockSessionStats } from "./mockData";
const { TAURI, appWindow } = await import(/* webpackChunkName: "taurishim" */"taurishim");

export const queryClient = new QueryClient();

const TorrentKeys = {
    all: (server: string) => [server, "torrent"] as const,
    listAll: (server: string, fields: TorrentFieldsType[]) =>
        [...TorrentKeys.all(server), "list", { fields }] as const,
    details: (server: string, torrentId: number) =>
        [...TorrentKeys.all(server), { torrentId }] as const,
};

const SessionKeys = {
    all: (server: string) => [server, "session"] as const,
    full: (server: string) => [...SessionKeys.all(server), "full"] as const,
};

const SessionStatsKeys = {
    all: (server: string) => [server, "sessionStats"] as const,
};

const BandwidthGroupKeys = {
    all: (server: string) => [server, "bandwidth-group"] as const,
};

export function useTorrentList(enabled: boolean, fields: TorrentFieldsType[]) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: TorrentKeys.listAll(serverConfig.name, fields),
        refetchInterval: 1000 * 5,
        staleTime: 1000,
        enabled,
        queryFn: useCallback(async () => {
            return mockTorrents;
        }, []),
    });
}

export function useTorrentDetails(torrentId: number, enabled: boolean, lookupIps: boolean, disableRefetch?: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: TorrentKeys.details(serverConfig.name, torrentId),
        refetchInterval: disableRefetch === true ? false : 1000 * 5,
        staleTime: 1000 * 5,
        enabled,
        queryFn: useCallback(async () => {
            const mock = mockTorrents.find((t) => t.id === torrentId);
            if (mock === undefined) throw new Error("Torrent not found");
            return mock;
        }, [torrentId]),
    });
}

export interface TorrentMutationVariables {
    torrentIds: number[],
    fields: Partial<Record<TorrentMutableFieldsType, any>>,
}

function updateCachedTorrentFields(
    serverName: string,
    torrentIds: number[],
    fields: Partial<Record<TorrentMutableFieldsType | TorrentAllFieldsType, any>>,
) {
    queryClient.setQueriesData(
        {
            predicate: (query) => {
                const key = query.queryKey;
                return key.length === 4 &&
                    key[0] === serverName &&
                    key[1] === "torrent" &&
                    key[2] === "list";
            },
        },
        (data: Torrent[] | undefined) => {
            if (data === undefined) return undefined;
            return data.map((t) => {
                if (!torrentIds.includes(t.id)) return t;
                return { ...t, ...fields };
            });
        },
    );
    queryClient.setQueriesData(
        {
            type: "active",
            predicate: (query) => {
                const key = query.queryKey;
                return key.length === 3 &&
                    key[0] === serverName &&
                    key[1] === "torrent" &&
                    torrentIds.includes((key[2] as { torrentId: number }).torrentId);
            },
        },
        (t: Torrent | undefined) => t === undefined ? undefined : { ...t, ...fields },
    );
}

export function useMutateTorrent() {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn: async ({ torrentIds, fields }: TorrentMutationVariables) => {
            updateCachedTorrentFields(serverConfig.name, torrentIds, fields);
        },
        onSuccess: () => {},
    });
}

export interface TorrentPathMutationVariables {
    torrentId: number,
    path: string,
    name: string,
}

export function useMutateTorrentPath() {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn: async ({ torrentId, path, name }: TorrentPathMutationVariables) => {
            updateCachedTorrentFields(serverConfig.name, [torrentId], { name });
        },
        onSuccess: () => {},
    });
}

function useInvalidatingTorrentAction<ActionParams>(mutationFn: (params: ActionParams) => Promise<void>) {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn,
        onSuccess: () => {
            void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
        },
    }).mutate;
}

export interface TorrentAddQueryParams extends TorrentAddParams {
    filePath?: string,
}

export function useAddTorrent(onSuccess: (response: any, vars: TorrentAddQueryParams) => void, onError: (e: Error) => void) {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn: async (params: TorrentAddQueryParams) => {
            return { hashString: "mock-hash", id: 99 };
        },
        onSuccess: (response: any, vars: TorrentAddQueryParams) => {
            onSuccess(response, vars);
            void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
        },
        onError,
    });
}

export function useRemoveTorrents() {
    return useInvalidatingTorrentAction(
        async ({ torrentIds, deleteData }: { torrentIds: number[], deleteData: boolean }) => {
            void torrentIds;
            void deleteData;
        });
}

export function useTorrentAction() {
    return useInvalidatingTorrentAction(
        async ({ method, torrentIds }: { method: TorrentActionMethodsType, torrentIds: number[] }) => {
            void method;
            void torrentIds;
        });
}

export function useTorrentChangeDirectory() {
    return useInvalidatingTorrentAction(
        async ({ torrentIds, location, move }: { torrentIds: number[], location: string, move: boolean }) => {
            void torrentIds;
            void location;
            void move;
        });
}

export function useTorrentAddTrackers() {
    return useInvalidatingTorrentAction(
        async ({ torrentId, trackers }: { torrentId: number, trackers: string[] }) => {
            void torrentId;
            void trackers;
        });
}

export function useSession(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: SessionKeys.all(serverConfig.name),
        refetchInterval: 1000 * 5,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return { ...mockSession };
        }, []),
    });
}

export function useSessionFull(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: SessionKeys.full(serverConfig.name),
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return { ...mockSession };
        }, []),
    });
}

export function useMutateSession() {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn: async (session: SessionInfo) => {
            void session;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries(SessionKeys.all(serverConfig.name));
        },
    });
}

export function useSessionStats(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: SessionStatsKeys.all(serverConfig.name),
        refetchInterval: 1000 * 5,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return { ...mockSessionStats };
        }, []),
    });
}

export function useTestPort(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: [serverConfig.name, "test-port"],
        staleTime: 1,
        enabled,
        queryFn: useCallback(async () => {
            return true;
        }, []),
    });
}

export function useUpdateBlocklist() {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation<number, Error>({
        mutationFn: async () => {
            return 0;
        },
        onSuccess: () => {
            void queryClient.refetchQueries(SessionKeys.full(serverConfig.name));
        },
    });
}

export function useBandwidthGroups(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: BandwidthGroupKeys.all(serverConfig.name),
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return [];
        }, []),
    });
}

export function useFileTree(name: string, fileTree: CachedFileTree) {
    const config = useContext(ConfigContext);

    const initialData = useMemo(
        () => fileTree.getView(config.values.interface.flatFileTree),
        [fileTree, config]);

    return useQuery({
        queryKey: [name],
        initialData,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        queryFn: () => fileTree.getView(config.values.interface.flatFileTree),
    });
}

export function refreshFileTree(name: string) {
    void queryClient.refetchQueries({ queryKey: [name] });
}

export function useIpLookup(ip: string) {
    const client = useTransmissionClient();

    return useQuery({
        queryKey: ["ips", ip],
        staleTime: Infinity,
        cacheTime: 10 * 60 * 1000,
        queryFn: async () => {
            return await client.ipsBatcher.fetch(ip);
        },
    });
}
