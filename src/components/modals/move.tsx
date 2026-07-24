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

import { Button, Checkbox, Divider, Group, Text } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";
import type { ModalState } from "./common";
import { HkModal, TorrentLocation, TorrentsNames, useTorrentLocation } from "./common";
import { useTorrentChangeDirectory } from "queries";
import { notifications } from "@mantine/notifications";
import { useServerSelectedTorrents, useServerTorrentData } from "rpc/torrent";

export function MoveModal(props: ModalState) {
    const serverData = useServerTorrentData();
    const serverSelected = useServerSelectedTorrents();
    const [moveData, setMoveData] = useState<boolean>(true);

    const location = useTorrentLocation();
    const { setPath, addPath } = location;

    const changeDirectory = useTorrentChangeDirectory();

    const onMove = useCallback(() => {
        changeDirectory(
            {
                torrentIds: Array.from(serverSelected),
                location: location.path,
                move: moveData,
            },
            {
                onSuccess: () => {
                    addPath(location.path);
                },
                onError: (e) => {
                    console.error("移动种子失败", e);
                    notifications.show({
                        message: "移动种子失败",
                        color: "red",
                    });
                },
            },
        );

        props.close();
    }, [changeDirectory, serverSelected, location.path, moveData, props, addPath]);

    const calculateInitialLocation = useCallback(() => {
        const [id] = [...serverSelected];
        const torrent = serverData.torrents.find((t) => t.id === id);
        return torrent?.downloadDir ?? "";
    }, [serverData.torrents, serverSelected]);

    useEffect(() => {
        if (props.opened) setPath(calculateInitialLocation());
    }, [props.opened, setPath, calculateInitialLocation]);

    return <>
        {props.opened
            && <HkModal
                opened={props.opened}
                onClose={props.close}
                title="移动种子"
                centered
                size="lg"
            >
                <Divider my="sm" />
                <Text mb="md">输入新位置</Text>
                <TorrentsNames />
                <TorrentLocation {...location} focusPath />
                <Checkbox
                    label="将种子数据移动到新位置"
                    checked={moveData}
                    onChange={(e) => { setMoveData(e.currentTarget.checked); }}
                    my="xl"
                />
                <Divider my="sm" />
                <Group justify="center" gap="md">
                    <Button onClick={onMove} variant="filled">移动</Button>
                    <Button onClick={props.close} variant="light">取消</Button>
                </Group>
            </HkModal>}
    </>;
}
