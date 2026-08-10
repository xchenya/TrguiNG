/**
 * Demo mode interceptor — ONLY included when BUILD_MODE=demo.
 * Production builds never import this file.
 *
 * Detects URL param ?demo=true or ?preview=true and returns mock data.
 */

import { mockTorrents, mockSession, mockSessionStats } from "./mockData";

declare const __BUILD_MODE__: string;

export function isDemoMode(): boolean {
    if (typeof __BUILD_MODE__ === "undefined" || __BUILD_MODE__ !== "demo") {
        return false;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "true" || params.get("preview") === "true";
}

export function getDemoTorrents(): typeof mockTorrents {
    return mockTorrents;
}

export function getDemoSession(): typeof mockSession {
    return { ...mockSession };
}

export function getDemoSessionStats(): typeof mockSessionStats {
    return { ...mockSessionStats };
}
