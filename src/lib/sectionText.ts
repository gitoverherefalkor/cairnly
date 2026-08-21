// Single implementation lives with the edge functions (Deno + frontend both
// import it; the module is pure TS with no Deno or browser APIs). See that
// file for the language-contract rules.
export * from '../../supabase/functions/_shared/sectionText';
