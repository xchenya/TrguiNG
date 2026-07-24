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

import type { NumberInputProps } from "@mantine/core";
import { Box, Button, Checkbox, Flex, Grid, Group, HoverCard, Loader, LoadingOverlay, NativeSelect, NumberInput, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import type { ServerConfig } from "config";
import { ConfigContext, ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import { queryClient, useMutateSession, useSessionFull, useTestPort, useUpdateBlocklist } from "queries";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type { SessionInfo } from "rpc/client";
import type { ExtendedCustomColors } from "types/mantine";
import type { BandwidthGroup } from "rpc/torrent";
import { notifications } from "@mantine/notifications";
import type { InterfaceFormValues } from "./interfacepanel";
import { InterfaceSettigsPanel } from "./interfacepanel";
import * as Icon from "react-bootstrap-icons";
const { TAURI } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface FormValues extends InterfaceFormValues {
    intervals: ServerConfig["intervals"],
    session?: SessionInfo,
    bandwidthGroups?: BandwidthGroup[],
}

function PollingPanel({ form }: { form: UseFormReturnType<FormValues> }) {
    return (
        <Grid align="center">
            <Grid.Col><Text>更新间隔（秒）</Text></Grid.Col>
            <Grid.Col span={8}>会话</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.session")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
            <Grid.Col span={8}>种子详情</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.details")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
            <Grid.Col span={8}>活动种子</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.torrents")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
            <Grid.Col span={8}>非活动/最小化时种子</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.torrentsMinimized")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
        </Grid>
    );
}

function DownloadPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col>
                <TextInput
                    label="默认下载目录（服务器设置）"
                    {...form.getInputProps("session.download-dir")}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={<Box>
                        <span>自动开始添加的种子</span>
                        <HoverCard width={280} shadow="md">
                            <HoverCard.Target>
                                <Icon.Question />
                            </HoverCard.Target>
                            <HoverCard.Dropdown>
                                <Text size="sm">
                                    This setting only applies to torrents added via the
                                    watch directory or by other clients that do not specify
                                    the start parameter. TrguiNG sets the start parameter
                                    based on your selection in the add torrent/magnet dialog.
                                </Text>
                            </HoverCard.Dropdown>
                        </HoverCard>
                    </Box>}
                    {...form.getInputProps("session.start-added-torrents", { type: "checkbox" })}
                />
            </Grid.Col>
            {session["rpc-version"] as number >= 18
                && <Grid.Col>
                    <Checkbox
                        mt="lg"
                        label="顺序下载种子"
                        {...form.getInputProps("session.sequential_download", { type: "checkbox" })}
                    />
                </Grid.Col>}
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label="未完成文件添加 .part 后缀"
                    {...form.getInputProps("session.rename-partial-files", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label="为未完成文件使用单独目录"
                    {...form.getInputProps("session.incomplete-dir-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <TextInput
                    label="未完成文件路径"
                    {...form.getInputProps("session.incomplete-dir")}
                    disabled={session["incomplete-dir-enabled"] !== true}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="使用默认分享率限制"
                    {...form.getInputProps("session.seedRatioLimited", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    step={0.05}
                    {...form.getInputProps("session.seedRatioLimit")}
                    disabled={session.seedRatioLimited !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="空闲种子停止时间"
                    {...form.getInputProps("session.idle-seeding-limit-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.idle-seeding-limit")}
                    disabled={session["idle-seeding-limit-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}>分钟</Grid.Col>
            <Grid.Col span={6}>磁盘缓存大小</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.cache-size-mb")}
                />
            </Grid.Col>
            <Grid.Col span={4}>MB</Grid.Col>
        </Grid>
    );
}

interface PortTestResult {
    label: string,
    color: ExtendedCustomColors,
}

function NetworkPanel(
    { opened, form, session }: {
        opened: boolean,
        form: UseFormReturnType<FormValues>,
        session: SessionInfo,
    },
) {
    const [testPortQueryEnbaled, setTestPortQueryEnabled] = useState(false);
    const [testPortResult, setTestPortResult] = useState<PortTestResult>({ label: "", color: "green" });

    const { data: testPort, status, fetchStatus, remove: removeQuery } = useTestPort(testPortQueryEnbaled);

    const onTestPort = useCallback(() => {
        setTestPortQueryEnabled(true);
    }, [setTestPortQueryEnabled]);

    useEffect(() => {
        if (fetchStatus !== "fetching") {
            setTestPortQueryEnabled(false);
        }
        if (status === "success") {
            setTestPortResult(testPort.arguments["port-is-open"] === true
                ? {
                    label: "Port is open",
                    color: "green",
                }
                : {
                    label: "Port unreachable",
                    color: "red",
                });
        } else if (status === "loading") {
            setTestPortResult({
                label: "",
                color: "green",
            });
        } else {
            setTestPortResult({
                label: "API error",
                color: "red",
            });
        }
    }, [fetchStatus, status, testPort]);

    useEffect(() => {
        if (!opened) {
            setTestPortResult({
                label: "",
                color: "green",
            });
            removeQuery();
        }
    }, [opened, setTestPortResult, removeQuery]);

    const { mutate: updateBlocklist, isLoading: updatePending } = useUpdateBlocklist();
    const onUpdateBlocklist = useCallback(() => {
        updateBlocklist(undefined, {
            onError: (e) => {
                console.log(e);
                notifications.show({
                    title: "更新黑名单失败",
                    message: e.message,
                    color: "red",
                });
            },
        });
    }, [updateBlocklist]);

    return (
        <Grid align="center">
            <Grid.Col span={3}>
                Incoming port:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={1}
                    max={65535}
                    {...form.getInputProps("session.peer-port")}
                    disabled={session["peer-port-random-on-start"] === true}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <Tooltip
                    withArrow
                    label="检查当前配置的端口。如有修改，请先保存再测试。"
                >
                    <Button
                        w="100%"
                        onClick={onTestPort}
                        title="测试端口"
                    >
                        Test port
                    </Button>
                </Tooltip>
            </Grid.Col>
            <Grid.Col span={3}>
                {fetchStatus === "fetching"
                    ? <Loader key="pt" size="1.5rem" />
                    : <Text key="pt" color={testPortResult.color}>{testPortResult.label}</Text>}
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label="让守护进程选择随机端口"
                    {...form.getInputProps("session.peer-port-random-on-start", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label="启用 UPnP 端口转发"
                    {...form.getInputProps("session.port-forwarding-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                Encryption:
            </Grid.Col>
            <Grid.Col span={3}>
                <NativeSelect
                    data={["tolerated", "preferred", "required"]}
                    {...form.getInputProps("session.encryption")}
                />
            </Grid.Col>
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>
                Global peer limit:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-global")}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                per torrent:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-per-torrent")}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    mt="lg"
                    label="启用用户交换"
                    {...form.getInputProps("session.pex-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    mt="lg"
                    label="启用 DHT"
                    {...form.getInputProps("session.dht-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    my="lg"
                    label="启用本地发现"
                    {...form.getInputProps("session.lpd-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    my="lg"
                    label="启用 uTP"
                    {...form.getInputProps("session.utp-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable blocklist:"
                    {...form.getInputProps("session.blocklist-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <TextInput
                    {...form.getInputProps("session.blocklist-url")}
                    disabled={session["blocklist-enabled"] !== true}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Text>
                    Blocklist contains
                    {session["blocklist-size"] as number}
                    entries
                </Text>
            </Grid.Col>
            <Grid.Col span={3}>
                <Tooltip
                    withArrow
                    label="获取当前配置的黑名单。如有修改，请先保存再更新。"
                >
                    <Button
                        w="100%"
                        onClick={onUpdateBlocklist}
                        title="更新黑名单"
                    >
                        Update
                    </Button>
                </Tooltip>
            </Grid.Col>
            <Grid.Col span={3}>
                {updatePending && <Loader size="1.5rem" />}
            </Grid.Col>
        </Grid>
    );
}

function TimeInput({ value, onChange, ...rest }: NumberInputProps) {
    const [hours, minutes] = useMemo(() => {
        const intVal = Number(value);
        return [Math.floor(intVal / 60), intVal % 60];
    }, [value]);

    const onHoursChange = useCallback((v: number | string) => {
        const h = Number(v);
        onChange?.(60 * h + minutes);
    }, [minutes, onChange]);
    const onMinutesChange = useCallback((v: number | string) => {
        const m = Number(v);
        onChange?.(60 * hours + m);
    }, [hours, onChange]);

    return (
        <div style={{ display: "flex" }}>
            <NumberInput
                min={0}
                max={23}
                step={1}
                value={hours}
                onChange={onHoursChange}
                {...rest}
            />
            <NumberInput
                min={0}
                max={59}
                step={1}
                value={minutes}
                onChange={onMinutesChange}
                {...rest}
            />
        </div>
    );
}

const DaysOfTheWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function DayOfWeekCheckbox({ form, day, session }: { form: UseFormReturnType<FormValues>, day: number, session: SessionInfo }) {
    return <Checkbox
        my="lg"
        label={DaysOfTheWeek[day]}
        checked={((session["alt-speed-time-day"] as number) & (1 << day)) > 0}
        onChange={(event) => {
            const val = session["alt-speed-time-day"] as number;
            form.setFieldValue(
                "session.alt-speed-time-day",
                event.currentTarget.checked ? val | (1 << day) : val & ~(1 << day));
        }}
        disabled={session["alt-speed-time-enabled"] !== true}
    />;
}

function BandwidthPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>正常</Grid.Col>
            <Grid.Col span={3}>备用</Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="最大下载速度 (KB/s)："
                    {...form.getInputProps("session.speed-limit-down-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-down")}
                    disabled={session["speed-limit-down-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-down")}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="最大上传速度 (KB/s)："
                    {...form.getInputProps("session.speed-limit-up-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-up")}
                    disabled={session["speed-limit-up-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-up")}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label="使用备用带宽设置"
                    {...form.getInputProps("session.alt-speed-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    my="lg"
                    label="自动应用备用带宽设置"
                    {...form.getInputProps("session.alt-speed-time-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>从：</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    {...form.getInputProps("session.alt-speed-time-begin")}
                    disabled={session["alt-speed-time-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={1}>到：</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    {...form.getInputProps("session.alt-speed-time-end")}
                    disabled={session["alt-speed-time-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={3}></Grid.Col>
            <Grid.Col span={2}>日期：</Grid.Col>
            <Grid.Col span={10}>
                <Group>
                    {DaysOfTheWeek.map((_, day) =>
                        (<DayOfWeekCheckbox
                            key={day}
                            form={form}
                            day={day}
                            session={session}
                        />))}
                </Group>
            </Grid.Col>
        </Grid>
    );
}

function QueuePanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col span={8}>
                <Checkbox
                    label="下载队列大小"
                    {...form.getInputProps("session.download-queue-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.download-queue-size")}
                    disabled={session["download-queue-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label="做种队列大小"
                    {...form.getInputProps("session.seed-queue-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.seed-queue-size")}
                    disabled={session["seed-queue-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label="空闲达到此时间后视为停滞"
                    {...form.getInputProps("session.queue-stalled-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.queue-stalled-minutes")}
                    disabled={session["queue-stalled-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={2}>分钟</Grid.Col>
        </Grid>
    );
}

function MagnetHandlerPanel() {
    const handlerUrl = useMemo(() => {
        const handlerUrl = new URL(window.location.href);
        handlerUrl.search = "add=%s";
        return handlerUrl;
    }, []);

    const registerHandler = useCallback(() => {
        navigator.registerProtocolHandler("magnet", handlerUrl.toString());
    }, [handlerUrl]);

    // Unregister handler only exists in some browsers
    const unregisterHandler = useCallback(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).unregisterProtocolHandler?.("magnet", handlerUrl.toString());
    }, [handlerUrl]);

    return (
        <Grid align="center">
            {window.location.protocol === "https:"
                ? <>
                    <Grid.Col span={6}>
                        <Text>注册磁力协议处理程序</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                        <Flex justify="space-around">
                            <Button onClick={registerHandler}>注册</Button>
                            {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                typeof (navigator as any).unregisterProtocolHandler === "function"
                                && <Button onClick={unregisterHandler}>取消注册</Button>
                            }
                        </Flex>
                    </Grid.Col>
                </>
                : <Grid.Col>
                    <Text mb="md">
                        Registering magnet protocol handler is currently not available.
                        Browsers support this feature only in secure contexts, i.e. https websites.
                    </Text>
                    <Text>
                        Transmission does not natively support serving the web interface with https but you can
                        setup a reverse proxy with ssl termination in front of it and use a self signed or letsencrypt
                        provided free certificate to secure your transmission web endpoint.
                    </Text>
                </Grid.Col>}
        </Grid>
    );
}

export function DaemonSettingsModal(props: ModalState) {
    const { data: session, fetchStatus } = useSessionFull(props.opened);
    const mutation = useMutateSession();
    const config = useContext(ConfigContext);
    const serverConfig = useContext(ServerConfigContext);

    const form = useForm<FormValues>({
        initialValues: {
            intervals: serverConfig.intervals,
            session,
            interface: config.values.interface,
        },
    });

    const { setFieldValue } = form;
    useEffect(() => {
        setFieldValue("session", session);
    }, [session, setFieldValue]);

    useEffect(() => {
        if (props.opened) {
            setFieldValue("interface", config.values.interface);
        }
    }, [config, props.opened, setFieldValue]);

    const onSave = useCallback(() => {
        serverConfig.intervals = { ...form.values.intervals };
        config.values.interface = { ...config.values.interface, ...form.values.interface };
        config.cleanup();
        void config.save();
        if (form.values.session !== undefined) {
            mutation.mutate(form.values.session, {
                onSuccess: () => {
                    notifications.show({
                        message: "会话保存成功",
                        color: "green",
                    });
                    props.close();
                    if (!TAURI) {
                        // clear client cache to make sure new interface settings are applied
                        queryClient.clear();
                    }
                },
                onError: (error) => {
                    notifications.show({
                        title: "更新服务器设置失败",
                        message: String(error),
                        color: "red",
                    });
                },
            });
        } else {
            props.close();
        }
    }, [form.values, mutation, props, config, serverConfig]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            saveLoading={mutation.isLoading}
            centered
            title="服务器设置"
        >
            <Box pos="relative">
                <LoadingOverlay visible={fetchStatus === "fetching"} overlayProps={{ blur: 2 }} />
                <Tabs defaultValue="polling" mih="33rem">
                    <Tabs.List>
                        <Tabs.Tab value="polling" p="lg">轮询设置</Tabs.Tab>
                        <Tabs.Tab value="download" p="lg">下载设置</Tabs.Tab>
                        <Tabs.Tab value="network" p="lg">网络设置</Tabs.Tab>
                        <Tabs.Tab value="bandwidth" p="lg">带宽设置</Tabs.Tab>
                        <Tabs.Tab value="queue" p="lg">队列设置</Tabs.Tab>
                        {!TAURI && <>
                            <Tabs.Tab value="interface" p="lg">界面设置</Tabs.Tab>
                            <Tabs.Tab value="magnethandler" p="lg">磁力链接</Tabs.Tab>
                        </>}
                    </Tabs.List>
                    {form.values.session !== undefined
                        ? <>
                            <Tabs.Panel value="polling" p="lg">
                                <PollingPanel form={form} />
                            </Tabs.Panel>

                            <Tabs.Panel value="download" p="lg">
                                <DownloadPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="network" p="lg">
                                <NetworkPanel opened={props.opened} form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="bandwidth" p="lg">
                                <BandwidthPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="queue" p="lg">
                                <QueuePanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            {!TAURI && <>
                                <Tabs.Panel value="interface" p="lg">
                                    <InterfaceSettigsPanel form={form} />
                                </Tabs.Panel>
                                <Tabs.Panel value="magnethandler" p="lg">
                                    <MagnetHandlerPanel />
                                </Tabs.Panel>
                            </>}
                        </>
                        : <></>}
                </Tabs>
            </Box>
        </SaveCancelModal>
    );
}
