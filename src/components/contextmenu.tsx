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

import type { MenuProps, PortalProps } from "@mantine/core";
import { Button, Menu, Portal, ScrollArea } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "../hooks/useResponsive";

export interface ContextMenuInfo {
    x: number,
    y: number,
    opened: boolean,
}

type ContextMenuHook = [
    ContextMenuInfo,
    React.Dispatch<ContextMenuInfo>,
    React.MouseEventHandler<HTMLElement>,
    (x: number, y: number) => void,
];

export function useContextMenu(): ContextMenuHook {
    const [info, setInfo] = useState<ContextMenuInfo>({ x: 0, y: 0, opened: false });

    const openContextMenu = useCallback((x: number, y: number) => {
        setInfo({ x, y, opened: true });
    }, [setInfo]);

    const contextMenuHandler = useCallback<React.MouseEventHandler<HTMLElement>>((e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY);
    }, [openContextMenu]);

    return [info, setInfo, contextMenuHandler, openContextMenu];
}

export interface ContextMenuProps extends MenuProps {
    contextMenuInfo: ContextMenuInfo,
    containerRef?: PortalProps["innerRef"],
    closeOnClickOutside?: boolean,
    setContextMenuInfo: (i: ContextMenuInfo) => void,
    onDismiss?: () => void,
}

export function ContextMenu({
    contextMenuInfo,
    containerRef,
    closeOnClickOutside = true,
    setContextMenuInfo,
    onDismiss,
    children,
    ...other
}: ContextMenuProps) {
    const isMobile = useIsMobile();

    const onClose = useCallback(
        () => {
            setContextMenuInfo({ ...contextMenuInfo, opened: false });
            onDismiss?.();
        },
        [contextMenuInfo, onDismiss, setContextMenuInfo]);

    const [opened, setOpened] = useState<boolean>(false);

    useEffect(() => { setOpened(contextMenuInfo.opened); }, [contextMenuInfo.opened]);

    return (
        <Menu {...other}
            opened={opened}
            onClose={onClose}
            offset={isMobile ? 8 : 0}
            middlewares={{ shift: true, flip: true }}
            position={isMobile ? "top" : "right-start"}
            closeOnClickOutside={closeOnClickOutside}
        >
            <Portal innerRef={containerRef}>
                <Menu.Target>
                    <Button unstyled
                        sx={{
                            position: "absolute",
                            width: 0,
                            height: 0,
                            padding: 0,
                            border: 0,
                        }}
                        style={{
                            left: isMobile ? 0 : contextMenuInfo.x,
                            top: isMobile ? 0 : contextMenuInfo.y,
                        }} />
                </Menu.Target>
                <Menu.Dropdown
                    sx={isMobile
                        ? (theme) => ({
                            position: "fixed",
                            left: "0.5rem !important",
                            right: "0.5rem !important",
                            bottom: 0,
                            top: "auto !important",
                            width: "calc(100vw - 1rem)",
                            maxWidth: "32rem",
                            marginInline: "auto",
                            borderRadius: `${theme.radius.lg} ${theme.radius.lg} 0 0`,
                            boxShadow: theme.shadows.xl,
                            padding: theme.spacing.xs,
                            "& .mantine-Menu-item": {
                                minHeight: "44px",
                                padding: theme.spacing.md,
                                borderRadius: theme.radius.md,
                            },
                            "& .mantine-Kbd-root": {
                                display: "none",
                            },
                        })
                        : undefined}
                >
                    <ScrollArea.Autosize
                        type="auto"
                        mah={isMobile ? "70vh" : "calc(100vh - 0.5rem)"}
                        offsetScrollbars
                        styles={{ viewport: { paddingBottom: 0 } }}
                    >
                        {children}
                    </ScrollArea.Autosize>
                </Menu.Dropdown>
            </Portal>
        </Menu>
    );
}
