import { createContext, useContext } from 'react';

// Encore (older professionals) prints with its own framing: "directions"
// instead of careers, "your idea" instead of dream jobs, no Pro-only tools on
// the closing page, and formal Dutch ("u"). The flag comes from
// report-print-data (`product.encore`), never from the browser, because the
// PDF renderer's headless Chromium has no Encore localStorage flag.
export const PrintEncoreContext = createContext(false);

export const usePrintEncore = (): boolean => useContext(PrintEncoreContext);
