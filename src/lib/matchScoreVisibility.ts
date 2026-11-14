import { createContext, useContext } from 'react';

// Encore shows no match number on careers ("directions"). Its top scores sit
// within a few points of each other and move a little between runs, so a
// number reads as more precise than it is (decision log, 2026-11-14). The
// scores still order the directions; only the number is hidden. The dashboard
// passes `hideMatchScores` as a prop, the printed report reads its Encore
// flag, and the chat reads this context.
export const HideMatchScoresContext = createContext(false);

export const useHideMatchScores = (): boolean => useContext(HideMatchScoresContext);
