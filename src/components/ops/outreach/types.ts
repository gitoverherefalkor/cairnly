// Shapes the cockpit reads from ops-outreach `list`. Mirrors the columns of
// outreach_concepts plus what the function joins on (queue row, answered mail).

export type ConceptSoort = 'initial' | 'chase' | 'checkin' | 'reply';
export type ConceptStatus = 'voorstel' | 'ingepland' | 'verzonden' | 'weggegooid' | 'verouderd' | 'geen_antwoord';

export interface ConceptRow {
  id: string;
  slug: string;
  naam: string | null;
  tier: string | null;
  soort: ConceptSoort;
  step: number | null;
  status: ConceptStatus;
  to_email: string;
  subject: string;
  body: string;
  body_origineel: string;
  skeleton: string | null;
  variant: string | null;
  basis: { dueAt?: string; status?: string; clicks?: number } & Record<string, unknown>;
  thread_id: string | null;
  answers_mail_id: string | null;
  validatie: { ok: boolean; problems: string[] };
  /** The second reader's verdict. 'template' = Sjoerd's own text, no model sentences. */
  beoordeling: { verdict: 'goed' | 'krom' | 'template' | 'onbekend'; reasons: string[]; zin?: string | null } | null;
  verouderd_reden: string | null;
  bewerkt_op: string | null;
  goedgekeurd_door: 'auto' | 'sjoerd' | null;
  goedgekeurd_op: string | null;
  verzonden_op: string | null;
  created_at: string;
  queue: { id: string; status: string; niet_voor: string | null; direct: boolean } | null;
  answers: {
    id: string;
    from_email: string | null;
    subject: string | null;
    body_text: string | null;
    snippet: string | null;
    sent_at: string;
    sentiment: string | null;
    samenvatting: string | null;
  } | null;
}

export interface HandledToday {
  auto_rejections: number;
  opt_outs: number;
  bounces: number;
  out_of_office: number;
}

/** How often the second reader judged a concept the way Sjoerd then did. */
export interface CriticAgreement {
  judged: number;
  agreed: number;
  /** Agreements in a row, newest first. */
  streak: number;
}

export interface CockpitSendState {
  gepauzeerd: boolean;
  auto_goedkeuren?: boolean;
  next_allowed_at: string | null;
  laatste_fout: string | null;
}

export interface CockpitSend {
  state: CockpitSendState | null;
  vandaag_verzonden: number;
  vandaag_koud?: number;
  mislukt: number;
  in_wachtrij: number;
}

export const SOORT_LABEL: Record<ConceptSoort, string> = {
  initial: 'First mail',
  chase: 'Chase',
  checkin: 'Check-in',
  reply: 'Reply',
};
