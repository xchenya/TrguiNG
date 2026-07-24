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
import type { ModalState } from "./common";
import { HkModal, TorrentsNames } from "./common";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useRemoveTorrents } from "queries";
import { notifications } from "@mantine/notifications";
import { useServerSelectedTorrents } from "rpc/torrent";
import { ConfigContext } from "config";

export function RemoveModal(props: ModalState) {
    const config = useContext(ConfigContext);
    const serverSelected = useServerSelectedTorrents();
    const [deleteData, setDeleteData] = useState<boolean>(false);

    useEffect(() => {
        if (props.opened) {
            if (config.values.interface.deleteTorrentData !== "记住选择") {
                setDeleteData(config.values.interface.deleteTorrentData === "默认开");
            } else {
                setDeleteData(config.values.interface.deleteTorrentDataSelection);
            }
        }
    }, [config, props.opened]);

    const onDeleteDataChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.currentTarget.checked;
        setDeleteData(value);
        config.values.interface.deleteTorrentDataSelection = value;
    }, [config]);

    const remove = useRemoveTorrents();

    const onDelete = useCallback(() => {
        remove(
            {
                torrentIds: Array.from(serverSelected),
                deleteData,
            },
            {
                onError: (e) => {
                    console.error("删除种子失败", e);
                    notifications.show({
                        message: "删除种子失败",
                        color: "red",
                    });
                },
            },
        );
        props.close();
    }, [remove, serverSelected, deleteData, props]);

    return (
        <HkModal
            opened={props.opened}
            onClose={props.close}
            title="删除种子"
            centered
            size="lg"
        >
            <Divider my="sm" />
            <Text mb="md">确定要删除以下种子吗？</Text>
            <TorrentsNames />
            <Checkbox
                label="删除数据文件"
                checked={deleteData}
                onChange={onDeleteDataChanged}
                my="xl"
            />
            <Divider my="sm" />
            <Group justify="center" gap="md">
                <Button
                    onClick={onDelete}
                    variant="filled"
                    color="red"
                    data-autofocus
                >
                    {deleteData ? "Delete" : "删除"}
                </Button>
                <Button onClick={props.close} variant="light">取消</Button>
            </Group>
        </HkModal>
    );
}
