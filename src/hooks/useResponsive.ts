import { useMediaQuery } from "@mantine/hooks";

export function useIsMobile() {
    return useMediaQuery("(max-width: 768px)");
}

export function useIsTablet() {
    return useMediaQuery("(max-width: 1024px)");
}
