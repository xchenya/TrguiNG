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
import { Box, Button, Checkbox, Grid, Group, Loader, LoadingOverlay, NativeSelect, NumberInput, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import type { ServerConfig } from "config";
import { ConfigContext, ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect, useState } from "react";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import { useMutateSession, useSessionFull, useTestPort, useUpdateBlocklist } from "queries";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type { SessionInfo } from "rpc/client";
import type { ExtendedCustomColors } from "types/mantine";
import type { BandwidthGroup } from "rpc/torrent";
import { notifications } from "@mantine/notifications";
import type { InterfaceFormValues } from "./interfacepanel";
import { InterfaceSettigsPanel } from "./interfacepanel";
const { TAURI } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface FormValues extends InterfaceFormValues {
    intervals: ServerConfig["intervals"],
    session?: SessionInfo,
    bandwidthGroups?: BandwidthGroup[],
}

function PollingPanel({ form }: { form: UseFormReturnType<FormValues> }) {
    return (
        <Grid align="center">
            <Grid.Col span={12}><Text>更新间隔设置 (秒)</Text></Grid.Col>
            <Grid.Col span={8}>会话更新</Grid.Col>
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
            <Grid.Col span={8}>未活动种子</Grid.Col>
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
                    label="默认保存目录"
                    {...form.getInputProps("session.download-dir")} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="在未完成的文件名后加上“.part”后缀"
                    {...form.getInputProps("session.rename-partial-files", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="启用临时目录"
                    {...form.getInputProps("session.incomplete-dir-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col>
                <TextInput
                    label="临时目录"
                    {...form.getInputProps("session.incomplete-dir")}
                    disabled={session["incomplete-dir-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="默认分享率上限"
                    {...form.getInputProps("session.seedRatioLimited", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    precision={2}
                    step={0.05}
                    {...form.getInputProps("session.seedRatioLimit")}
                    disabled={session.seedRatioLimited !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="默认停止无流量种子持续时间"
                    {...form.getInputProps("session.idle-seeding-limit-enabled", { type: "checkbox" })} />
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
                    label: "端口连接成功",
                    color: "green",
                }
                : {
                    label: "端口不可连接",
                    color: "red",
                });
        } else if (status === "loading") {
            setTestPortResult({
                label: "",
                color: "green",
            });
        } else {
            setTestPortResult({
                label: "API 错误",
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
                    title: "更新黑名单列表失败",
                    message: e.message,
                    color: "red",
                });
            },
        });
    }, [updateBlocklist]);

    return (
        <Grid align="center">
            <Grid.Col span={3}>
                连接端口号:
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
                    label="如果更改了端口，测试前请先进行保存。">
                    <Button
                        w="100%"
                        onClick={onTestPort}
                    >
                        测试端口
                    </Button>
                </Tooltip>
            </Grid.Col>
            <Grid.Col span={3}>
                {fetchStatus === "fetching"
                    ? <Loader key="pt" size="1.5rem" />
                    : <Text key="pt" color={testPortResult.color}>{testPortResult.label}</Text>
                }
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用随机端口"
                    {...form.getInputProps("session.peer-port-random-on-start", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用端口转发(UPnP)"
                    {...form.getInputProps("session.port-forwarding-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={3}>
                加密:
            </Grid.Col>
            <Grid.Col span={3}>
                <NativeSelect
                    data={[{value:"tolerated",label:"允许加密"},{value:"preferred",label:"优先加密"},{value:"required",label:"强制加密"}]}
                    {...form.getInputProps("session.encryption")} />
            </Grid.Col>
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>
                全局最大链接数:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-global")}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                单种最大链接数:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-per-torrent")}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用用户交换"
                    {...form.getInputProps("session.pex-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用分布式哈希表(DHT)"
                    {...form.getInputProps("session.dht-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用本地用户发现(LPD)"
                    {...form.getInputProps("session.lpd-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用带宽管理(µTP)"
                    {...form.getInputProps("session.utp-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="启用黑名单列表:"
                    {...form.getInputProps("session.blocklist-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <TextInput
                    {...form.getInputProps("session.blocklist-url")}
                    disabled={session["blocklist-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Text>可用规则数量 {session["blocklist-size"]} 条</Text>
            </Grid.Col>
            <Grid.Col span={3}>
                <Tooltip
                    withArrow
                    label="如果有修改内容，更新之前先进行保存。">
                    <Button
                        w="100%"
                        onClick={onUpdateBlocklist}
                        title=""
                    >
                        更新黑名单
                    </Button>
                </Tooltip>
            </Grid.Col>
            <Grid.Col span={3}>
                {updatePending && <Loader size="1.5rem" />}
            </Grid.Col>
        </Grid>
    );
}

function toTimeStr(time: string) {
    const t = parseInt(time);
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

function fromTimeStr(time: string) {
    const parts = time.split(":");
    if (parts.length !== 2) return "";
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) return "";
    return `${h * 60 + m}`;
}

function TimeInput(props: NumberInputProps) {
    return <NumberInput
        {...props}
        parser={fromTimeStr}
        formatter={toTimeStr}
    />;
}

const DaysOfTheWeek = ["星期天", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;

function DayOfWeekCheckbox({ form, day, session }: { form: UseFormReturnType<FormValues>, day: number, session: SessionInfo }) {
    return <Checkbox
        label={DaysOfTheWeek[day]}
        checked={(session["alt-speed-time-day"] & (1 << day)) > 0}
        onChange={(event) => {
            const val = session["alt-speed-time-day"];
            form.setFieldValue(
                "session.alt-speed-time-day",
                event.currentTarget.checked ? val | (1 << day) : val & ~(1 << day));
        }}
        disabled={session["alt-speed-time-enabled"] !== true} />;
}

function BandwidthPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>正常</Grid.Col>
            <Grid.Col span={3}>备用</Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="最大下载速度 (KB/s):"
                    {...form.getInputProps("session.speed-limit-down-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-down")}
                    disabled={session["speed-limit-down-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-down")} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="最大上传速度 (KB/s):"
                    {...form.getInputProps("session.speed-limit-up-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-up")}
                    disabled={session["speed-limit-up-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-up")} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="启用备用带宽"
                    {...form.getInputProps("session.alt-speed-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="自动启用备用带宽设置(时间段内)"
                    {...form.getInputProps("session.alt-speed-time-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={1}>从:</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    min={0}
                    max={24 * 60 - 1}
                    {...form.getInputProps("session.alt-speed-time-begin")}
                    disabled={session["alt-speed-time-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={1}>到:</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    min={0}
                    max={24 * 60 - 1}
                    {...form.getInputProps("session.alt-speed-time-end")}
                    disabled={session["alt-speed-time-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={12}>
                <Group>
                    {DaysOfTheWeek.map((_, day) =>
                        <DayOfWeekCheckbox key={day} form={form} day={day} session={session} />)}
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
                    label="启用下载队列，最大同时下载数"
                    {...form.getInputProps("session.download-queue-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.download-queue-size")}
                    disabled={session["download-queue-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label="启用上传队列，最大同时上传数"
                    {...form.getInputProps("session.seed-queue-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.seed-queue-size")}
                    disabled={session["seed-queue-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label="种子超过该时间无流量，移出队列"
                    {...form.getInputProps("session.queue-stalled-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.queue-stalled-minutes")}
                    disabled={session["queue-stalled-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}>分钟</Grid.Col>
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { form.setFieldValue("session", session); }, [session]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (props.opened) {
            form.setFieldValue("interface", { ...config.values.interface });
        }
    }, [props.opened]);

    const onSave = useCallback(() => {
        serverConfig.intervals = { ...form.values.intervals };
        config.values.interface = { ...config.values.interface, ...form.values.interface };
        if (form.values.session !== undefined) {
            mutation.mutate(form.values.session, {
                onSuccess: () => {
                    notifications.show({
                        message: "配置保存成功",
                        color: "green",
                    });
                    props.close();
                },
                onError: (error) => {
                    notifications.show({
                        title: "配置保存失败",
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
            title="参数设置"
        >
            <Box pos="relative">
                <LoadingOverlay visible={fetchStatus === "fetching"} overlayBlur={2} />
                <Tabs defaultValue="polling" mih="25rem">
                    <Tabs.List>
                        <Tabs.Tab value="polling" p="lg">轮询设置</Tabs.Tab>
                        <Tabs.Tab value="download" p="lg">下载设置</Tabs.Tab>
                        <Tabs.Tab value="network" p="lg">网络设置</Tabs.Tab>
                        <Tabs.Tab value="bandwidth" p="lg">带宽设置</Tabs.Tab>
                        <Tabs.Tab value="queue" p="lg">队列设置</Tabs.Tab>
                        {!TAURI && <Tabs.Tab value="interface" p="lg">其他设置</Tabs.Tab>}
                    </Tabs.List>
                    {form.values.session !== undefined
                        ? <>
                            <Tabs.Panel value="polling" pt="md">
                                <PollingPanel form={form} />
                            </Tabs.Panel>

                            <Tabs.Panel value="download" pt="md">
                                <DownloadPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="network" pt="md">
                                <NetworkPanel opened={props.opened} form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="bandwidth" pt="md">
                                <BandwidthPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="queue" pt="md">
                                <QueuePanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            {!TAURI && <Tabs.Panel value="interface" pt="md">
                                <InterfaceSettigsPanel form={form} />
                            </Tabs.Panel>}
                        </>
                        : <></>}
                </Tabs>
            </Box>
        </SaveCancelModal>
    );
}
