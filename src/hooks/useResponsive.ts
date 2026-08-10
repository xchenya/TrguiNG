import { useMediaQuery } from "@mantine/hooks";

function hasMobileParam(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.get("h5") === "true" || params.get("mobile") === "true";
}

export function useIsMobile() {
    const mediaQuery = useMediaQuery("(max-width: 768px)");
    if (hasMobileParam()) return true;
    return mediaQuery ?? false;
}

export function useIsTablet() {
    return useMediaQuery("(max-width: 1024px)");
}
