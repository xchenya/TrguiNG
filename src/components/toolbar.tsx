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

import type { MantineTheme } from "@mantine/core";
import { ActionIcon, Box, Button, Drawer, Flex, Kbd, Menu, NativeSelect, SegmentedControl, Text, TextInput, useMantineTheme } from "@mantine/core";
import debounce from "lodash-es/debounce";
import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Icon from "react-bootstrap-icons";
import PriorityIcon from "svg/icons/priority.svg";
import type { PriorityNumberType } from "rpc/transmission";
import { BandwidthPriority, Status } from "rpc/transmission";
import { useTorrentAction, useMutateSession, useMutateTorrent } from "queries";
import { notifications } from "@mantine/notifications";
import type { TorrentActionMethodsType } from "rpc/client";
import type { ModalCallbacks } from "./modals/servermodals";
import type { HotkeyHandlers } from "hotkeys";
import { useHotkeysContext } from "hotkeys";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { bytesToHumanReadableStr, modKeyString } from "trutil";
import { useServerSelectedTorrents, useServerTorrentData } from "rpc/torrent";
import { useIsMobile } from "../hooks/useResponsive";

interface ToolbarButtonProps extends React.PropsWithChildren<React.ComponentPropsWithRef<"button">> {
    depressed?: boolean,
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
    { children, depressed, ...other }: ToolbarButtonProps, ref,
) {
    return (
        <Button variant="light" compact h="2.5rem" {...other} ref={ref}
            styles={(theme: MantineTheme) => ({
                root: {
                    backgroundColor: theme.colorScheme === "dark"
                        ? theme.colors.gray[depressed === true ? 8 : 9]
                        : theme.colors.gray[depressed === true ? 3 : 1],
                    transform: depressed === true ? "scale(-1, 1)" : "none",
                    color: theme.colorScheme === "dark"
                        ? theme.colors.gray[3]
                        : theme.colors.gray[8],
                },
            })}
        >
            {children}
        </Button>
    );
});

interface ToolbarProps {
    setSearchTerms: (terms: string[]) => void,
    searchTracker: string,
    setSearchTracker: (tracker: string) => void,
    showTrackerSpeed: boolean,
    trackers: Record<string, { count: number, speed: number }>,
    modals: React.RefObject<ModalCallbacks>,
    altSpeedMode: boolean,
    toggleFiltersPanel: () => void,
    toggleDetailsPanel: () => void,
    toggleMainSplit: () => void,
    toggleShowRunStatus: () => void,
    openFiltersDrawer: () => void,
    mobileSelectionMode: boolean,
    enterMobileSelectionMode: () => void,
    exitMobileSelectionMode: () => void,
    selectAllMobileTorrents: () => void,
    mobileStatusFilter: string,
    setMobileStatusFilter: (filter: string) => void,
}

function useButtonHandlers(
    props: ToolbarProps,
    altSpeedMode: boolean | undefined,
    setAltSpeedMode: React.Dispatch<boolean | undefined>,
) {
    const serverData = useServerTorrentData();
    const serverSelected = useServerSelectedTorrents();
    const actionMutate = useTorrentAction();
    const { mutate: mutateTorrent } = useMutateTorrent();

    const handlers = useMemo(() => {
        const checkSelected = (action?: () => void) => {
            return () => {
                if (serverSelected.size > 0) action?.();
            };
        };
        type ActionType = "selected" | "all" | "done" | "error" | "download";
        const action = (method: TorrentActionMethodsType, t: ActionType = "selected") => () => {
            let ids = new Array<number>();
            if (t === "selected") {
                ids = Array.from(serverSelected);
            } else if (t === "all") {
                if (method === "torrent-start" || method === "torrent-start-now") {
                    ids = serverData.torrents.filter((t) => t.status === Status.stopped).map((t) => t.id as number);
                } else if (method === "torrent-stop") {
                    ids = serverData.torrents.filter((t) => t.status !== Status.stopped).map((t) => t.id as number);
                }
            } else if (t === "done") {
                ids = serverData.torrents.filter((t) => t.status === Status.stopped &&
                    (t.sizeWhenDone > 0 && Math.max(t.sizeWhenDone - t.haveValid, 0) === 0)).map((t) => t.id as number);
            } else if (t === "error") {
                ids = serverData.torrents.filter((t) => t.error !== 0 || t.cachedError !== "").map((t) => t.id as number);
            } else if (t === "download") {
                ids = serverData.torrents.filter((t) => t.status === Status.downloading).map((t) => t.id as number);
            }
            actionMutate(
                {
                    method,
                    torrentIds: ids,
                },
                {
                    onSuccess: () => {
                        notifications.show({
                            message: "执行成功",
                            color: "green",
                        });
                    },
                    onError: (e) => {
                        console.log("执行出错", method, e);
                        notifications.show({
                            message: "执行出错",
                            color: "red",
                        });
                    },
                },
            );
        };
        const priority = (bandwidthPriority: PriorityNumberType) => () => {
            mutateTorrent(
                {
                    torrentIds: Array.from(serverSelected),
                    fields: { bandwidthPriority },
                },
                {
                    onSuccess: () => {
                        notifications.show({
                            message: "优先级已更新",
                            color: "green",
                        });
                    },
                    onError: (error) => {
                        notifications.show({
                            title: "优先级更新失败",
                            message: String(error),
                            color: "red",
                        });
                    },
                },
            );
        };

        return {
            start: checkSelected(action("torrent-start")),
            startAll: action("torrent-start", "all"),
            startDone: action("torrent-start", "done"),
            pause: checkSelected(action("torrent-stop")),
            pauseAll: action("torrent-stop", "all"),
            pauseError: action("torrent-stop", "error"),
            pauseDownload: action("torrent-stop", "download"),
            remove: checkSelected(props.modals.current?.remove),
            queueDown: checkSelected(action("queue-move-down")),
            queueUp: checkSelected(action("queue-move-up")),
            move: checkSelected(props.modals.current?.move),
            setLabels: checkSelected(props.modals.current?.setLabels),
            setPriorityHigh: checkSelected(priority(BandwidthPriority.high)),
            setPriorityNormal: checkSelected(priority(BandwidthPriority.normal)),
            setPriorityLow: checkSelected(priority(BandwidthPriority.low)),
            daemonSettings: () => { props.modals.current?.daemonSettings(); },
        };
    }, [actionMutate, mutateTorrent, props.modals, serverData, serverSelected]);

    const sessionMutation = useMutateSession();

    const toggleAltSpeedMode = useCallback(() => {
        sessionMutation.mutate({ "alt-speed-enabled": altSpeedMode !== true }, {
            onError: (_, session) => {
                setAltSpeedMode(session["alt-speed-enabled"] !== true);
            },
        });
        setAltSpeedMode(altSpeedMode !== true);
    }, [altSpeedMode, sessionMutation, setAltSpeedMode]);

    const hk = useHotkeysContext();

    useEffect(() => {
        hk.handlers = { ...hk.handlers, ...handlers };
        return () => {
            Object.keys(handlers).forEach((k) => { hk.handlers[k as keyof HotkeyHandlers] = () => { }; });
        };
    }, [hk, handlers]);

    return {
        ...handlers,
        toggleAltSpeedMode,
    };
}

function MobileToolbar(props: ToolbarProps) {
    const theme = useMantineTheme();
    const [altSpeedMode, setAltSpeedMode] = useState<boolean | undefined>(props.altSpeedMode);
    const handlers = useButtonHandlers(props, altSpeedMode, setAltSpeedMode);
    const searchRef = useRef<HTMLInputElement>(null);
    const serverSelected = useServerSelectedTorrents();
    const selected = useMemo(() => serverSelected?.size > 0, [serverSelected]);
    const [addDrawerOpened, { open: openAddDrawer, close: closeAddDrawer }] = useDisclosure(false);

    const debouncedSetSearchTerms = useMemo(
        () => debounce(props.setSearchTerms, 500, { trailing: true, leading: false }),
        [props.setSearchTerms]);

    useEffect(() => {
        setAltSpeedMode(props.altSpeedMode);
    }, [props.altSpeedMode]);

    useEffect(() => {
        return () => { debouncedSetSearchTerms.cancel(); };
    }, [debouncedSetSearchTerms]);

    const onSearchInput = useCallback((e: React.FormEvent) => {
        debouncedSetSearchTerms(
            (e.target as HTMLInputElement).value
                .split(" ")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s !== ""));
    }, [debouncedSetSearchTerms]);

    const onSearchClear = useCallback(() => {
        debouncedSetSearchTerms.cancel();
        if (searchRef.current != null) searchRef.current.value = "";
        props.setSearchTerms([]);
    }, [debouncedSetSearchTerms, props]);

    return (
        <Flex direction="column" w="100%">
            {props.mobileSelectionMode
                ? <Flex className="mobile-selection-header" w="100%" align="center" justify="space-between" gap="xs" p="xs">
                    <Button variant="subtle" compact onClick={props.exitMobileSelectionMode}>取消</Button>
                    <Text weight={600}>已选 {serverSelected.size} 项</Text>
                    <Button variant="subtle" compact onClick={props.selectAllMobileTorrents}>全选</Button>
                </Flex>
                : <>
                    <Flex className="mobile-browse-header" w="100%" align="center" gap="xs" p="xs" pb={4}>
                        <ActionIcon variant="default" size="lg" onClick={props.openFiltersDrawer} title="高级筛选">
                            <Icon.Funnel size="1.1rem" />
                        </ActionIcon>
                        <TextInput
                            ref={searchRef}
                            placeholder="搜索种子"
                            icon={<Icon.Search size="1rem" />}
                            rightSection={<ActionIcon onClick={onSearchClear} title="清除搜索">
                                <Icon.XLg size="1rem" color={theme.colors.red[6]} />
                            </ActionIcon>}
                            onInput={onSearchInput}
                            sx={{ flexGrow: 1 }}
                            styles={{ input: { height: "2.5rem", borderRadius: theme.radius.md } }}
                        />
                        <Button variant="subtle" compact onClick={props.enterMobileSelectionMode}>选择</Button>
                    </Flex>
                    <SegmentedControl
                        mx="xs"
                        mb="xs"
                        fullWidth
                        value={props.mobileStatusFilter}
                        onChange={props.setMobileStatusFilter}
                        data={["全部", "下载中", "已完成", "错误"]}
                    />
                </>}
            {props.mobileSelectionMode && <Box
                sx={{
                    position: "fixed",
                    bottom: "var(--mobile-statusbar-height)",
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    backgroundColor: theme.colorScheme === "dark" ? theme.colors.dark[8] : theme.colors.gray[0],
                    borderTop: `1px solid ${theme.colorScheme === "dark" ? theme.colors.dark[5] : theme.colors.gray[3]}`,
                }}
            >
                <Flex justify="space-around" align="center" p="xs">
                    <ActionIcon variant="subtle" size="lg" disabled={!selected} onClick={handlers.start}>
                        <Icon.PlayCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.blue[6]} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" size="lg" disabled={!selected} onClick={handlers.pause}>
                        <Icon.PauseCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.blue[6]} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" size="lg" disabled={!selected} onClick={handlers.remove}>
                        <Icon.XCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.red[6]} />
                    </ActionIcon>
                    <Menu shadow="md" width="12rem" withinPortal position="top-end">
                        <Menu.Target>
                            <ActionIcon variant="subtle" size="lg">
                                <Icon.ThreeDots size="1.5rem" />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item icon={<Icon.PlusSquare size="1rem" />} onClick={() => props.modals.current?.addMagnet()}>
                                添加种子链接
                            </Menu.Item>
                            <Menu.Item icon={<Icon.ArrowUpCircleFill size="1rem" />} disabled={!selected} onClick={handlers.queueUp}>
                                队列上移
                            </Menu.Item>
                            <Menu.Item icon={<Icon.ArrowDownCircleFill size="1rem" />} disabled={!selected} onClick={handlers.queueDown}>
                                队列下移
                            </Menu.Item>
                            <Menu.Item icon={<Icon.FolderFill size="1rem" />} disabled={!selected} onClick={handlers.move}>
                                修改目录
                            </Menu.Item>
                            <Menu.Item icon={<Icon.TagsFill size="1rem" />} disabled={!selected} onClick={handlers.setLabels}>
                                设置标签
                            </Menu.Item>
                            <Menu.Item icon={<Icon.InfoCircleFill size="1rem" />} disabled={serverSelected.size !== 1} onClick={props.toggleDetailsPanel}>
                                种子详情
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item icon={<Icon.Speedometer2 size="1rem" />} onClick={handlers.toggleAltSpeedMode}>
                                切换备用带宽
                            </Menu.Item>
                            <Menu.Item icon={<Icon.Tools size="1rem" />} onClick={handlers.daemonSettings}>
                                设置
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Flex>
            </Box>}
            {!props.mobileSelectionMode && <ActionIcon
                className="mobile-add-fab"
                variant="filled"
                color="blue"
                size="3.5rem"
                radius="xl"
                onClick={openAddDrawer}
                title="添加种子"
                sx={{ position: "fixed", right: "1rem", bottom: "calc(var(--mobile-statusbar-height) + 0.75rem)", zIndex: 100 }}
            >
                <Icon.PlusLg size="1.5rem" />
            </ActionIcon>}
            <Drawer opened={addDrawerOpened} onClose={closeAddDrawer} position="bottom" size="auto" title="添加种子">
                <Flex direction="column" gap="sm" pb="md">
                    <Button leftIcon={<Icon.MagnetFill />} size="lg" variant="light" onClick={() => {
                        closeAddDrawer();
                        props.modals.current?.addMagnet();
                    }}>添加种子链接</Button>
                    <Button leftIcon={<Icon.FileArrowDownFill />} size="lg" variant="light" onClick={() => {
                        closeAddDrawer();
                        props.modals.current?.addTorrent();
                    }}>上传种子文件</Button>
                </Flex>
            </Drawer>
        </Flex>
    );
}

function DesktopToolbar(props: ToolbarProps) {
    const debouncedSetSearchTerms = useMemo(
        () => debounce(props.setSearchTerms, 500, { trailing: true, leading: false }),
        [props.setSearchTerms]);

    const [altSpeedMode, setAltSpeedMode] = useState<boolean>();

    useEffect(() => {
        if (props.altSpeedMode !== undefined) setAltSpeedMode(props.altSpeedMode);
    }, [props.altSpeedMode]);

    const onSearchInput = useCallback((e: React.FormEvent) => {
        debouncedSetSearchTerms(
            (e.target as HTMLInputElement).value
                .split(" ")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s !== ""));
    }, [debouncedSetSearchTerms]);

    const trackersData = useMemo(() => {
        if (props.showTrackerSpeed) {
            let totalSpeed = 0;
            const values = Object.keys(props.trackers).sort().map((tracker) => {
                const node = props.trackers[tracker];
                totalSpeed += node.speed;
                return { value: tracker, label: `${tracker} (${node.count}) [${bytesToHumanReadableStr(node.speed)}/s]` };
            });
            return [{ value: "", label: "<All Trackers> " + `[${bytesToHumanReadableStr(totalSpeed)}/s]` }, ...values];
        } else {
            const values = Object.keys(props.trackers).sort().map((tracker) => {
                return { value: tracker, label: `${tracker} (${props.trackers[tracker].count})` };
            });
            return [{ value: "", label: "<All Trackers>" }, ...values];
        }
    }, [props.showTrackerSpeed, props.trackers]);

    const onTackerChange = useCallback((tracker: string) => {
        if (tracker === "") {
            props.setSearchTracker("");
        } else {
            props.setSearchTracker(tracker);
        }
    }, [props]);

    const searchRef = useRef<HTMLInputElement>(null);

    const onSearchClear = useCallback(() => {
        if (searchRef.current != null) searchRef.current.value = "";
        props.setSearchTerms([]);
    }, [props]);

    const theme = useMantineTheme();
    const handlers = useButtonHandlers(props, altSpeedMode, setAltSpeedMode);

    const hk = useHotkeysContext();

    useEffect(() => {
        hk.handlers.focusSearch = () => searchRef.current?.focus();
        return () => { hk.handlers.focusSearch = () => { }; };
    }, [hk]);

    useHotkeys([
        ["mod + P", props.toggleMainSplit],
        ["mod + O", props.toggleFiltersPanel],
        ["mod + I", props.toggleDetailsPanel],
        ["mod + R", props.toggleShowRunStatus],
    ]);

    const serverSelected = useServerSelectedTorrents();
    const selected = useMemo(() => {
        return serverSelected?.size > 0;
    }, [serverSelected]);

    return (
        <Flex w="100%" align="stretch">
            <Button.Group mx="sm">
                <ToolbarButton
                    title="添加种子文件"
                    onClick={() => { props.modals.current?.addTorrent(); }}>
                    <Icon.FileArrowDownFill size="1.5rem" color={theme.colors.green[8]} />
                </ToolbarButton>
                <ToolbarButton
                    title="添加种子链接"
                    onClick={() => { props.modals.current?.addMagnet(); }}>
                    <Icon.MagnetFill size="1.5rem" color={theme.colors.green[8]} />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton
                    title="开始选中 (F3)"
                    disabled={!selected}
                    onClick={handlers.start} >
                    <Icon.PlayCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.blue[6]} />
                </ToolbarButton>
                <ToolbarButton
                    title="暂停选中 (F4)"
                    disabled={!selected}
                    onClick={handlers.pause} >
                    <Icon.PauseCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.blue[6]} />
                </ToolbarButton>
                <ToolbarButton
                    title="删除 (del)"
                    disabled={!selected}
                    onClick={handlers.remove}>
                    <Icon.XCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.red[6]} />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton
                    title="队列上移"
                    disabled={!selected}
                    onClick={handlers.queueUp} >
                    <Icon.ArrowUpCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.green[8]} />
                </ToolbarButton>
                <ToolbarButton
                    title="队列下移"
                    onClick={handlers.queueDown} >
                    <Icon.ArrowDownCircleFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.green[8]} />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton
                    title="修改目录 (F6)"
                    disabled={!selected}
                    onClick={handlers.move}>
                    <Icon.FolderFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.yellow[4]} stroke={!selected ? theme.colors.gray[5] : theme.colors.yellow[5]} />
                </ToolbarButton>
                <ToolbarButton
                    title="设置用户标签 (F7)"
                    disabled={!selected}
                    onClick={handlers.setLabels} >
                    <Icon.TagsFill size="1.5rem" color={!selected ? theme.colors.gray[5] : theme.colors.blue[6]} />
                </ToolbarButton>

                <Menu shadow="md" width="10rem" withinPortal middlewares={{ shift: true, flip: false }}>
                    <Menu.Target>
                        <ToolbarButton title="调整优先级" disabled={!selected}>
                            <PriorityIcon width="1.5rem" height="1.5rem"
                                fill={!selected ? theme.colors.gray[5] : (theme.colors.yellow[theme.colorScheme === "dark" ? 4 : 6])} />
                        </ToolbarButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Item icon={<Icon.CircleFill color={theme.colors.orange[7]} />}
                            onClick={handlers.setPriorityHigh} rightSection={<Kbd>{`${modKeyString()} H`}</Kbd>}>
                            高
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color={theme.colors.teal[9]} />}
                            onClick={handlers.setPriorityNormal} rightSection={<Kbd>{`${modKeyString()} N`}</Kbd>}>
                            正常
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color={theme.colors.yellow[6]} />}
                            onClick={handlers.setPriorityLow} rightSection={<Kbd>{`${modKeyString()} L`}</Kbd>}>
                            低
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Button.Group>

            <Button.Group mx="sm">
                <Menu shadow="lg" width="15rem" withinPortal middlewares={{ shift: true, flip: false }}>
                    <Menu.Target>
                        <ToolbarButton title="开始" disabled={false}>
                            <Icon.PlayCircleFill size="1.5rem" color={theme.colors.dark[6]} />
                        </ToolbarButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Item p={"lg"} icon={<Icon.PlayFill size={"1.0rem"} color={theme.colors.yellow[7]} />} onClick={handlers.startAll}>
                            开始所有种子
                        </Menu.Item>
                        <Menu.Item p={"lg"} icon={<Icon.PlayFill size={"1.0rem"} color={theme.colors.blue[7]} />} onClick={handlers.startDone}>
                            开始已完成的种子
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
                <Menu shadow="lg" width="15rem" withinPortal middlewares={{ shift: true, flip: false }}>
                    <Menu.Target>
                        <ToolbarButton title="暂停" disabled={false}>
                            <Icon.PauseCircleFill size="1.5rem" color={theme.colors.dark[6]} />
                        </ToolbarButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Item p={"lg"} icon={<Icon.PauseFill size={"1.0rem"} color={theme.colors.blue[7]} />} onClick={handlers.pauseAll}>
                            暂停所有种子
                        </Menu.Item>
                        <Menu.Item p={"lg"} icon={<Icon.PauseFill size={"1.0rem"} color={theme.colors.red[7]} />} onClick={handlers.pauseError}>
                            暂停错误的种子
                        </Menu.Item>
                        <Menu.Item p={"lg"} icon={<Icon.PauseFill size={"1.0rem"} color={theme.colors.yellow[7]} />} onClick={handlers.pauseDownload}>
                            暂停下载中的种子
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Button.Group>

            <ToolbarButton
                title={`开启备用带宽限速 ${altSpeedMode === true ? "off" : "on"} (F8)`}
                onClick={handlers.toggleAltSpeedMode}
                depressed={altSpeedMode}
            >
                <Icon.Speedometer2 size="1.5rem" />
            </ToolbarButton>

            <TextInput mx="sm" ref={searchRef}
                icon={<Icon.Search size="1rem" />}
                placeholder={`搜索种子 (${modKeyString()} + f)`}
                rightSection={<ActionIcon onClick={onSearchClear} title="Clear">
                    <Icon.XLg size="1rem" color={theme.colors.red[6]} />
                </ActionIcon>}
                onInput={onSearchInput}
                styles={{ root: { flexGrow: 1 }, input: { height: "auto" } }}
            />
            <NativeSelect w="auto" miw={props.showTrackerSpeed ? "25rem" : "20rem"}
                data={trackersData} value={props.searchTracker}
                onChange={(e) => { onTackerChange(e.currentTarget.value); }} />

            <Menu shadow="md" width="16rem" withinPortal middlewares={{ shift: true, flip: true }}>
                <Menu.Target>
                    <ToolbarButton title="布局">
                        <Icon.Grid1x2Fill size="1.5rem" style={{ transform: "rotate(-90deg)" }} />
                    </ToolbarButton>
                </Menu.Target>

                <Menu.Dropdown>
                    <Menu.Item
                        onClick={props.toggleMainSplit} rightSection={<Kbd>{`${modKeyString()} P`}</Kbd>}>
                        切换布局
                    </Menu.Item>
                    <Menu.Item
                        onClick={props.toggleFiltersPanel} rightSection={<Kbd>{`${modKeyString()} O`}</Kbd>}>
                        隐藏/展示分组
                    </Menu.Item>
                    <Menu.Item
                        onClick={props.toggleDetailsPanel} rightSection={<Kbd>{`${modKeyString()} I`}</Kbd>}>
                        隐藏/展示详情
                    </Menu.Item>
                    <Menu.Item
                        onClick={props.toggleShowRunStatus} rightSection={<Kbd>{`${modKeyString()} R`}</Kbd>}>
                        隐藏/展示运行状态
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>

            <ToolbarButton
                title="设置 (F9)"
                onClick={handlers.daemonSettings}>
                <Icon.Tools size="1.5rem" />
            </ToolbarButton>
        </Flex>
    );
}

function Toolbar(props: ToolbarProps) {
    const isMobile = useIsMobile();

    return isMobile
        ? <MobileToolbar {...props} />
        : <DesktopToolbar {...props} />;
}

export const MemoizedToolbar = memo(Toolbar) as typeof Toolbar;
