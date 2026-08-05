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

import { ActionIcon, Badge, Box, Checkbox, Flex, Text, useMantineTheme } from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import * as Icon from "react-bootstrap-icons";
import type { Torrent } from "rpc/torrent";
import { Status, StatusStrings } from "rpc/transmission";
import { StatusIconMap, Error as StatusIconError, Magnetizing, CompletedStopped } from "components/statusicons";
import { ProgressBar } from "../progressbar";
import { bytesToHumanReadableStr, secondsToHumanReadableStr } from "trutil";
import type { TableSelectReducer } from "./common";

interface TorrentCardProps {
    torrent: Torrent,
    selected: boolean,
    setCurrentTorrent: (id: string) => void,
    selectedReducer: TableSelectReducer,
    openContextMenu: (x: number, y: number) => void,
    openTorrentDetails: (id: string) => void,
    selectionMode: boolean,
}

function torrentEta(torrent: Torrent): string {
    const eta = torrent.eta as number | undefined;
    if (eta === undefined || eta === -1) return "";
    if (eta < -1) return "∞";
    return secondsToHumanReadableStr(eta);
}

function progressVariant(torrent: Torrent): "default" | "green" | "dark-green" | "red" {
    if ((torrent.error !== undefined && torrent.error > 0) || torrent.cachedError !== "") return "red";
    if (torrent.rateDownload > 0 || torrent.rateUpload > 0) return "green";
    if (torrent.status === Status.stopped && torrent.sizeWhenDone > 0 && torrent.leftUntilDone === 0) return "dark-green";
    return "default";
}

function TorrentCard(props: TorrentCardProps) {
    const theme = useMantineTheme();
    const { torrent } = props;

    let StatusIcon = StatusIconMap[torrent.status];
    if (torrent.status === Status.downloading && torrent.pieceCount === 0) {
        StatusIcon = Magnetizing;
    }
    if (torrent.status === Status.stopped && torrent.sizeWhenDone > 0 && torrent.leftUntilDone === 0) {
        StatusIcon = CompletedStopped;
    }
    if ((torrent.error !== undefined && torrent.error > 0) || torrent.cachedError !== "") {
        StatusIcon = StatusIconError;
    }

    const percentDone = ((torrent.percentDone ?? 0) as number) * 100;
    const eta = torrentEta(torrent);

    const { openContextMenu, selectedReducer, setCurrentTorrent } = props;

    const onClick = useCallback(() => {
        if (props.selectionMode) {
            selectedReducer({ verb: "toggle", ids: [String(torrent.id)] });
        } else {
            props.openTorrentDetails(String(torrent.id));
        }
    }, [props, selectedReducer, torrent.id]);

    const onSelectClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        selectedReducer({ verb: "toggle", ids: [String(torrent.id)] });
    }, [selectedReducer, torrent.id]);

    const onMoreClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        selectedReducer({ verb: "set", ids: [String(torrent.id)] });
        setCurrentTorrent(String(torrent.id));
        openContextMenu(event.clientX, event.clientY);
    }, [openContextMenu, selectedReducer, setCurrentTorrent, torrent.id]);

    return <Box
        className="torrent-card"
        onClick={onClick}
        sx={{
            border: `1px solid ${props.selectionMode && props.selected
                ? theme.colors.blue[5]
                : theme.colorScheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[3]}`,
            backgroundColor: props.selectionMode && props.selected
                ? theme.fn.rgba(theme.colors.blue[6], theme.colorScheme === "dark" ? 0.28 : 0.12)
                : theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.white,
            borderRadius: theme.radius.md,
            boxShadow: props.selected ? theme.shadows.sm : undefined,
        }}
    >
        <Flex className={`torrent-card-header ${props.selectionMode ? "selection-mode" : "browse-mode"}`} align="center" gap="xs" mb={6}>
            {props.selectionMode && <Checkbox
                className="torrent-card-checkbox"
                checked={props.selected}
                onClick={onSelectClick}
                onChange={() => {}}
                aria-label={`选择 ${String(torrent.name)}`}
                size="md"
            />}
            <Box sx={{ flexShrink: 0 }}><StatusIcon /></Box>
            <Text weight={600} size="md" lineClamp={2} sx={{ flexGrow: 1, lineHeight: 1.25 }}>
                {torrent.name}
            </Text>
            <ActionIcon variant="subtle" size="lg" onClick={onMoreClick} aria-label={`操作 ${String(torrent.name)}`}>
                <Icon.ThreeDotsVertical size="1.2rem" />
            </ActionIcon>
        </Flex>
        <Flex justify="space-between" align="center" mb={6}>
            <Text size="xs" color="dimmed">{StatusStrings[torrent.status]}</Text>
            <Text size="xs" color="dimmed">{percentDone.toFixed(1)}%</Text>
        </Flex>
        {torrent.labels?.length > 0 && <Flex gap={4} mb={6} wrap="nowrap" sx={{ overflow: "hidden" }}>
            {torrent.labels.slice(0, 3).map((label: string) => <Badge key={label} size="xs" radius="sm" variant="filled">
                {label}
            </Badge>)}
            {torrent.labels.length > 3 && <Badge size="xs" radius="sm" variant="outline">+{torrent.labels.length - 3}</Badge>}
        </Flex>}
        <ProgressBar
            now={percentDone}
            variant={progressVariant(torrent)}
            animate={torrent.rateDownload > 0 || torrent.rateUpload > 0}
            className="white-outline"
        />
        <Flex justify="space-between" align="center" mt={6} gap="xs">
            <Text size="xs" color={torrent.rateDownload > 0 ? "blue" : "dimmed"}>
                ↓{bytesToHumanReadableStr(torrent.rateDownload)}/s
            </Text>
            <Text size="xs" color={torrent.rateUpload > 0 ? "green" : "dimmed"}>
                ↑{bytesToHumanReadableStr(torrent.rateUpload)}/s
            </Text>
            <Text size="xs" color="dimmed">
                {bytesToHumanReadableStr(torrent.totalSize ?? torrent.sizeWhenDone)}
            </Text>
            <Text size="xs" color="dimmed" lineClamp={1}>
                {eta === "" ? torrent.cachedMainTracker : `剩余 ${eta}`}
            </Text>
        </Flex>
    </Box>;
}

const MemoizedTorrentCard = memo(TorrentCard) as typeof TorrentCard;

export function MobileTorrentList(props: {
    torrents: Torrent[],
    selected: Set<number>,
    setCurrentTorrent: (id: string) => void,
    selectedReducer: TableSelectReducer,
    openContextMenu: (x: number, y: number) => void,
    scrollToRow?: { id: string },
    openTorrentDetails: (id: string) => void,
    selectionMode: boolean,
}) {
    const parentRef = useRef<HTMLDivElement | null>(null);
    const rowHeight = 160;

    const rowVirtualizer = useVirtualizer({
        count: props.torrents.length,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => rowHeight, []),
        overscan: 4,
    });

    const scrollToId = useMemo(() => {
        return props.torrents.findIndex((torrent) => String(torrent.id) === props.scrollToRow?.id);
    }, [props.scrollToRow?.id, props.torrents]);

    useEffect(() => {
        if (scrollToId >= 0) {
            rowVirtualizer.scrollToIndex(scrollToId, { align: "auto" });
        }
    }, [rowVirtualizer, scrollToId]);

    return <Box ref={parentRef} className="mobile-torrent-list">
        <Box sx={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const torrent = props.torrents[virtualRow.index];
                return <Box
                    key={torrent.id}
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }}
                >
                    <MemoizedTorrentCard
                        torrent={torrent}
                        selected={props.selected.has(torrent.id)}
                        setCurrentTorrent={props.setCurrentTorrent}
                        selectedReducer={props.selectedReducer}
                        openContextMenu={props.openContextMenu}
                        openTorrentDetails={props.openTorrentDetails}
                        selectionMode={props.selectionMode}
                    />
                </Box>;
            })}
        </Box>
    </Box>;
}
